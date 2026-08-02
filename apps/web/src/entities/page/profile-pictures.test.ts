import { describe, expect, it, vi } from "vitest";
import { fetchProfilePictures, profilePicturesQueryKey } from "./profile-pictures";

describe("fetchProfilePictures", () => {
  it("연결된 Page·Instagram 계정 이미지를 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pagePicture: "https://page", igPicture: "https://ig" }),
    }));

    await expect(fetchProfilePictures()).resolves.toEqual({ pagePicture: "https://page", igPicture: "https://ig" });
    expect(profilePicturesQueryKey("page-1", "ig-1")).toEqual(["profile-pictures", "page-1", "ig-1"]);
    vi.unstubAllGlobals();
  });

  it("이미지를 읽지 못하면 빈 이미지로 처리한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Unauthorized" }) }));

    await expect(fetchProfilePictures()).resolves.toEqual({ pagePicture: null, igPicture: null });
    vi.unstubAllGlobals();
  });
});
