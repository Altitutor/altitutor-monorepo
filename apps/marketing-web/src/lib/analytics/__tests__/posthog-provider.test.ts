import { renderToStaticMarkup } from "react-dom/server";
import { MarketingPostHogProvider } from "../posthog-provider";
import { readUcatObservedFirstTouchCookie } from "../../../../../../packages/shared/src/ucat/acquisition-attribution";

let mockPathname = "/blog/review-your-mock/";
let mockQuery = "utm_source=newsletter&utm_campaign=mock-review";
const mockEffects: Array<() => void> = [];
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useEffect: (effect: () => void) => {
    mockEffects.push(effect);
  },
}));
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock(
  "@altitutor/shared",
  () =>
    jest.requireActual(
      "../../../../../../packages/shared/src/ucat/acquisition-attribution",
    ),
  { virtual: true },
);
jest.mock("../posthog", () => ({ captureMarketingEvent: jest.fn() }));

function visit(pathname: string, query = "") {
  mockPathname = pathname;
  mockQuery = query;
  renderToStaticMarkup(MarketingPostHogProvider({ children: null }));
  mockEffects.splice(0).forEach((effect) => effect());
}

describe("blog acquisition attribution", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          hostname: "altitutor.com",
          origin: "https://altitutor.com",
        },
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "", referrer: "https://www.google.com/" },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
  });
  it.each(["/blog/", "/blog/review-your-mock/"])(
    "preserves %s and campaign data through UCAT navigation",
    (path) => {
      visit(path, "utm_source=newsletter&utm_campaign=mock-review");
      visit("/ucat/");
      expect(readUcatObservedFirstTouchCookie(document.cookie)).toMatchObject({
        landingPath: path,
        utmSource: "newsletter",
        utmCampaign: "mock-review",
        referrerDomain: "www.google.com",
      });
    },
  );
  it("does not overwrite an earlier observed first touch", () => {
    visit("/ucat/", "utm_source=school");
    const original = document.cookie;
    visit("/blog/review-your-mock/", "utm_source=newsletter");
    expect(document.cookie).toBe(original);
  });
  it("does not capture unrelated paths with matching prefixes", () => {
    visit("/blogger/");
    expect(document.cookie).toBe("");
  });
});
