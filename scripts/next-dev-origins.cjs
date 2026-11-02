const os = require("node:os");
const net = require("node:net");

function isPrivateIpv4(address) {
  if (net.isIP(address) !== 4) return false;

  const [first, second] = address.split(".").map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function getLocalDevOrigins() {
  if (process.env.NODE_ENV !== "development") return [];

  const addresses = Object.values(os.networkInterfaces()).flatMap(
    (networkInterface) => networkInterface ?? [],
  );

  return [
    ...new Set(
      addresses
        .filter(
          (entry) =>
            !entry.internal &&
            (entry.family === "IPv4" || entry.family === 4) &&
            isPrivateIpv4(entry.address),
        )
        .map((entry) => entry.address),
    ),
  ].sort();
}

module.exports = { getLocalDevOrigins };
