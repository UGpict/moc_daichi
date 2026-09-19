import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlacesPhotoName, vibeFromCategories } from "../src/server/places/photoName";

describe("places photo names", () => {
  it("accepts Places Photo resource names only", () => {
    assert.equal(
      parsePlacesPhotoName("places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/ATKogpe-abc_12"),
      "places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/ATKogpe-abc_12",
    );
    assert.equal(parsePlacesPhotoName("https://evil.example/x.jpg"), null);
    assert.equal(parsePlacesPhotoName("places/../photos/x"), null);
    assert.equal(parsePlacesPhotoName("mock:nagoya-castle"), "mock:nagoya-castle");
  });

  it("maps categories to this-session vibe labels", () => {
    assert.equal(vibeFromCategories(["cafe", "bakery"], "PARTNER"), "甘いもの");
    assert.equal(vibeFromCategories(["museum"], "SELF"), "展示");
    assert.equal(vibeFromCategories(["park"], "SELF"), "散歩");
  });
});
