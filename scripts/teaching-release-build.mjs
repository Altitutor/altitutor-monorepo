import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { access, appendFile, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const team = 'V2A5FZKMZ7';
const bundle = 'com.altitutor.teaching';
const appID = '6829958017';
const issuer = '78aab419-6d0d-4cbb-a296-73a1fbffec6f';
const provisioningProfilesDirectory = join(homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles');

// Subprocess output can contain signing diagnostics. Keep it off logs/artifacts.
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', timeout: 1_200_000, maxBuffer: 64 * 1024 * 1024, ...options }).trim();
  } catch {
    throw new Error(`${command.split('/').at(-1)} failed; raw signing output was withheld`);
  }
}

function appleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: env.TEACHING_ASC_KEY_ID, typ: 'JWT' })}.${encode({ iss: issuer, iat: now, exp: now + 540, aud: 'appstoreconnect-v1' })}`;
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: createPrivateKey(env.TEACHING_ASC_PRIVATE_KEY), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function apple(path, env) {
  const url = new URL(path, 'https://api.appstoreconnect.apple.com');
  if (url.origin !== 'https://api.appstoreconnect.apple.com') throw new Error('Invalid Apple pagination origin');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${appleToken(env)}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`App Store Connect read failed (HTTP ${response.status})`);
  return response.json();
}

async function existingBuilds(env) {
  const builds = [];
  let path = `/v1/builds?filter[app]=${appID}&limit=200`;
  while (path) {
    const page = await apple(path, env);
    if (!Array.isArray(page.data)) throw new Error('Missing Apple build history');
    builds.push(...page.data);
    if (builds.length > 5000) throw new Error('Apple build history exceeds bounded release validation');
    path = page.links?.next;
  }
  return builds;
}

function value(plist, key) {
  return run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]);
}

function xml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }

export async function cleanupRelease() {
  const root = process.env.RUNNER_TEMP;
  if (process.platform !== 'darwin' || process.env.GITHUB_ACTIONS !== 'true' || !root) throw new Error('Cleanup requires the owned macOS Actions runner');
  const receiptPath = join(root, 'teaching-signing-state.json');
  let state;
  try { state = JSON.parse(await readFile(receiptPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw new Error('Cannot read signing cleanup receipt'); }
  const profileRoot = provisioningProfilesDirectory + sep;
  if (typeof state.temporary !== 'string' || !resolve(state.temporary).startsWith(resolve(root) + sep + 'teaching-signing-') ||
      state.keychain !== join(state.temporary, 'signing.keychain-db') || !Array.isArray(state.originalSearch) ||
      !state.originalSearch.every((path) => typeof path === 'string' && path.startsWith('/')) ||
      (state.profile && (!state.profile.startsWith(profileRoot) || !/^[A-Fa-f0-9-]{36}\.mobileprovision$/.test(state.profile.slice(profileRoot.length))))) throw new Error('Signing cleanup ownership receipt is invalid');
  const failures = [];
  let keychainExists = false;
  try { await access(state.keychain); keychainExists = true; } catch (error) { if (error.code !== 'ENOENT') failures.push('keychain inventory'); }
  if (keychainExists) {
    try { run('security', ['list-keychains', '-d', 'user', '-s', ...state.originalSearch]); } catch { failures.push('search list'); }
    try { run('security', ['delete-keychain', state.keychain]); } catch { failures.push('keychain'); }
  }
  try { if (state.profile) await rm(state.profile, { force: true }); } catch { failures.push('profile'); }
  try { await rm(state.temporary, { recursive: true, force: true }); } catch { failures.push('temporary files'); }
  if (failures.length) throw new Error(`Signing cleanup requires attention: ${failures.join(', ')}`);
  await rm(receiptPath);
}

export async function runRelease(plan, checkBuild) {
  const env = process.env;
  if (process.platform !== 'darwin' || env.GITHUB_ACTIONS !== 'true' || !env.RUNNER_TEMP) throw new Error('Signing requires the protected ephemeral macOS Actions runner');
  if (!/^[A-Z0-9]{10}$/.test(env.TEACHING_ASC_KEY_ID ?? '') || env.TEACHING_ASC_ISSUER_ID !== issuer) throw new Error('Unexpected Apple key identifier or team issuer');
  const privateKey = createPrivateKey(env.TEACHING_ASC_PRIVATE_KEY);
  if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Apple API key must be an ES256 P8 key');
  const source = resolve('release-source');
  if (run('git', ['-C', source, 'rev-parse', 'HEAD']) !== plan.sourceSHA ||
      run('git', ['-C', source, 'status', '--porcelain']) !== '') throw new Error('Archive source differs from the clean verified commit');
  const toolchain = run('xcodebuild', ['-version']);
  if (toolchain !== 'Xcode 26.5\nBuild version 17F42') throw new Error('Expected pinned Xcode 26.5 / 17F42');
  const app = await apple(`/v1/apps/${appID}`, env);
  if (app.data?.attributes?.bundleId !== bundle) throw new Error('App Store Connect app does not match Teaching');
  const prior = await existingBuilds(env);
  checkBuild({ buildNumber: plan.buildNumber, existing: prior.map((build) => build.attributes.version) });

  const temporary = await mkdtemp(join(env.RUNNER_TEMP, 'teaching-signing-'));
  const output = join(env.RUNNER_TEMP, 'teaching-release-artifacts');
  await mkdir(output, { recursive: true, mode: 0o700 });
  const keychain = join(temporary, 'signing.keychain-db');
  const profileFile = join(temporary, 'distribution.mobileprovision');
  const profilePlist = join(temporary, 'profile.plist');
  const keyDirectory = join(temporary, 'private_keys');
  const certificate = join(temporary, 'distribution.p12');
  const keychainPassword = randomBytes(32).toString('hex');
  const originalSearch = [...run('security', ['list-keychains', '-d', 'user']).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (!originalSearch.length) throw new Error('Could not capture original runner keychain search list');
  const signingState = { temporary, keychain, originalSearch, profile: null };
  const statePath = join(env.RUNNER_TEMP, 'teaching-signing-state.json');
  await writeFile(statePath, JSON.stringify(signingState), { mode: 0o600 });
  const receipt = { ...plan, bundle, team, appID, toolchain, uploadState: 'not-attempted', processingState: null };
  const record = () => writeFile(join(output, 'release.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  try {
    for (const [name, path] of [['TEACHING_DISTRIBUTION_P12_BASE64', certificate], ['TEACHING_PROFILE_BASE64', profileFile]]) {
      const encoded = env[name].replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 2_000_000) throw new Error(`Invalid protected ${name} encoding`);
      const bytes = Buffer.from(encoded, 'base64');
      if (!bytes.length || bytes.toString('base64') !== encoded) throw new Error(`Invalid protected ${name} encoding`);
      await writeFile(path, bytes, { mode: 0o600 });
    }
    await mkdir(keyDirectory, { mode: 0o700 });
    await writeFile(join(keyDirectory, `AuthKey_${env.TEACHING_ASC_KEY_ID}.p8`), env.TEACHING_ASC_PRIVATE_KEY, { mode: 0o600 });
    await writeFile(profilePlist, run('security', ['cms', '-D', '-i', profileFile]), { mode: 0o600 });
    const uuid = value(profilePlist, 'UUID');
    if (!/^[A-Fa-f0-9-]{36}$/.test(uuid) || value(profilePlist, 'TeamIdentifier:0') !== team ||
        value(profilePlist, 'Entitlements:application-identifier') !== `${team}.${bundle}` ||
        value(profilePlist, 'Entitlements:get-task-allow') !== 'false') throw new Error('Provisioning profile is not the Teaching distribution profile');
    const decodedProfile = await readFile(profilePlist, 'utf8');
    if (decodedProfile.includes('<key>ProvisionedDevices</key>') || decodedProfile.includes('<key>ProvisionsAllDevices</key>')) throw new Error('Use an App Store profile, not development/ad-hoc/enterprise');
    const expiry = decodedProfile.match(/<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/)?.[1];
    if (!expiry || Date.parse(expiry) <= Date.now()) throw new Error('Provisioning profile has expired');
    await mkdir(provisioningProfilesDirectory, { recursive: true, mode: 0o700 });
    const destination = join(provisioningProfilesDirectory, `${uuid}.mobileprovision`);
    try { await access(destination); throw new Error('Runner already has this provisioning profile; refusing to overwrite'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    signingState.profile = destination;
    await writeFile(statePath, JSON.stringify(signingState), { mode: 0o600 });
    await copyFile(profileFile, destination);
    run('security', ['create-keychain', '-p', keychainPassword, keychain]);
    run('security', ['set-keychain-settings', '-lut', '3600', keychain]);
    run('security', ['unlock-keychain', '-p', keychainPassword, keychain]);
    run('security', ['import', certificate, '-P', env.TEACHING_DISTRIBUTION_P12_PASSWORD, '-t', 'cert', '-f', 'pkcs12', '-k', keychain, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security']);
    run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', keychainPassword, keychain]);
    run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalSearch]);
    const identities = run('security', ['find-identity', '-v', '-p', 'codesigning', keychain]);
    const identity = identities.match(/([A-F0-9]{40}) "(?:Apple|iPhone) Distribution: Altitutor Pty Ltd \(V2A5FZKMZ7\)"/)?.[1];
    if (!identity) throw new Error('Expected Altitutor Apple/iOS Distribution identity is missing or invalid');
    const archive = join(output, 'AltitutorTeaching.xcarchive');
    run('xcodebuild', ['-project', join(source, 'apps/teaching-ipad/AltitutorTeaching.xcodeproj'), '-scheme', 'AltitutorTeaching',
      '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive,
      '-derivedDataPath', join(temporary, 'derived'), `DEVELOPMENT_TEAM=${team}`, 'CODE_SIGN_STYLE=Manual',
      `CODE_SIGN_IDENTITY=${identity}`, `PROVISIONING_PROFILE_SPECIFIER=${uuid}`, `CURRENT_PROJECT_VERSION=${plan.buildNumber}`,
      `TEACHING_API_URL=${plan.apiURL}`, 'archive']);
    const info = join(archive, 'Products/Applications/AltitutorTeaching.app/Info.plist');
    if (value(info, 'CFBundleIdentifier') !== bundle || value(info, 'CFBundleVersion') !== plan.buildNumber || value(info, 'TeachingAPIURL') !== plan.apiURL) throw new Error('Signed archive identity/backend differs from release plan');
    receipt.marketingVersion = value(info, 'CFBundleShortVersionString');
    const options = join(temporary, 'ExportOptions.plist');
    await writeFile(options, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
      <key>method</key><string>app-store-connect</string><key>destination</key><string>export</string>
      <key>teamID</key><string>${team}</string><key>signingStyle</key><string>manual</string>
      <key>signingCertificate</key><string>${identity}</string><key>provisioningProfiles</key><dict><key>${bundle}</key><string>${xml(uuid)}</string></dict>
      <key>manageAppVersionAndBuildNumber</key><false/><key>testFlightInternalTestingOnly</key><false/><key>uploadSymbols</key><true/>
      </dict></plist>`, { mode: 0o600 });
    const exported = join(temporary, 'exported');
    run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exported, '-exportOptionsPlist', options]);
    const ipas = (await readdir(exported)).filter((file) => file.endsWith('.ipa'));
    if (ipas.length !== 1) throw new Error('Expected exactly one exported IPA');
    const ipa = join(output, 'AltitutorTeaching.ipa');
    await copyFile(join(exported, ipas[0]), ipa);
    receipt.ipaSHA256 = createHash('sha256').update(await readFile(ipa)).digest('hex');
    receipt.archiveState = 'exported';
    await record();
    if (plan.upload) {
      // Never automatically retry this call: a transport failure can be ambiguous.
      receipt.uploadState = 'attempting'; await record();
      try {
        run('xcrun', ['altool', '--upload-app', '-f', ipa, '--api-key', env.TEACHING_ASC_KEY_ID, '--api-issuer', issuer],
          { env: { ...env, API_PRIVATE_KEYS_DIR: keyDirectory } });
      } catch {
        receipt.uploadState = 'ambiguous'; await record();
        throw new Error('Apple upload failed or is ambiguous; inspect the exact build before another attempt');
      }
      receipt.uploadState = 'accepted'; await record();
      const deadline = Date.now() + 20 * 60_000;
      while (Date.now() < deadline) {
        const response = await apple(`/v1/builds?filter[app]=${appID}&filter[version]=${plan.buildNumber}&limit=20`, env);
        const build = response.data?.find((entry) => entry.attributes?.version === plan.buildNumber);
        receipt.appleBuildID = build?.id ?? null;
        receipt.processingState = build?.attributes?.processingState ?? 'not-yet-visible';
        await record();
        if (receipt.processingState === 'VALID') break;
        if (['FAILED', 'INVALID'].includes(receipt.processingState)) throw new Error('Apple processing rejected the build; inspect App Store Connect');
        await setTimeout(30_000);
      }
      if (receipt.processingState !== 'VALID') throw new Error('Upload accepted; Apple processing is still pending. Inspect the recorded build before retrying');
    }
    if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `## Teaching release\n\nSource: ${plan.sourceSHA}\n\nBackend: ${plan.apiURL}\n\nVersion: ${receipt.marketingVersion} (${plan.buildNumber})\n\nUpload: ${receipt.uploadState}; Apple processing: ${receipt.processingState ?? 'not requested'}.\n\nIPA SHA-256: ${receipt.ipaSHA256}\n\nTester availability, App Review, unlisted approval and release are separate steps.\n`);
  } finally {
    // The workflow also invokes cleanup in an always() step after cancellation.
    let recordFailed = false;
    try { await record(); } catch { recordFailed = true; }
    await cleanupRelease();
    if (recordFailed) throw new Error('Could not preserve sanitized release receipt');
  }
}
