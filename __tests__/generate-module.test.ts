import { describe, expect, it } from "bun:test";
import {
  toCamelCase,
  toModuleSlug,
  toPascalCase,
  toTagLabel,
} from "../scripts/generate-module";

describe("generate-module naming", () => {
  it("slugifies module names", () => {
    expect(toModuleSlug("User Profile")).toBe("user-profile");
    expect(toModuleSlug("users")).toBe("users");
  });

  it("builds pascal, camel, and tag labels", () => {
    expect(toPascalCase("user-profile")).toBe("UserProfile");
    expect(toCamelCase("user-profile")).toBe("userProfile");
    expect(toTagLabel("user-profile")).toBe("User Profile");
  });
});
