import { describe, it, expect } from "vitest";
import { feedChunk } from "./image-stream";

describe("feedChunk", () => {
  it("완성된 data 줄 → image 이벤트, rest 비움", () => {
    const { events, rest } = feedChunk("", `data: {"index":0,"image":"abc"}\n`);
    expect(events).toEqual([{ kind: "image", index: 0, image: "abc" }]);
    expect(rest).toBe("");
  });

  it("청크 경계에서 줄이 잘림 → rest 이월 후 다음 청크에서 합쳐져 파싱", () => {
    const r1 = feedChunk("", `data: {"index":1,`);
    expect(r1.events).toEqual([]); // 미완성 → 아직 이벤트 없음
    expect(r1.rest).toBe(`data: {"index":1,`);

    const r2 = feedChunk(r1.rest, `"image":"xy"}\n`);
    expect(r2.events).toEqual([{ kind: "image", index: 1, image: "xy" }]);
    expect(r2.rest).toBe("");
  });

  it("[DONE] → done 이벤트", () => {
    const { events } = feedChunk("", "data: [DONE]\n");
    expect(events).toEqual([{ kind: "done" }]);
  });

  it("error 필드 → error 이벤트", () => {
    const { events } = feedChunk("", `data: {"error":"보안 차단"}\n`);
    expect(events).toEqual([{ kind: "error", message: "보안 차단" }]);
  });

  it("data: 가 아닌 줄·빈 줄은 무시", () => {
    const { events } = feedChunk("", `: keep-alive\n\nfoo\n`);
    expect(events).toEqual([]);
  });

  it("깨진 JSON 줄은 건너뜀(throw 안 함)", () => {
    const { events } = feedChunk("", `data: {not json\ndata: {"index":2,"image":"ok"}\n`);
    expect(events).toEqual([{ kind: "image", index: 2, image: "ok" }]);
  });

  it("한 청크에 여러 줄 → 순서대로 다중 이벤트", () => {
    const { events } = feedChunk(
      "",
      `data: {"index":0,"image":"a"}\ndata: {"index":1,"image":"b"}\ndata: [DONE]\n`,
    );
    expect(events).toEqual([
      { kind: "image", index: 0, image: "a" },
      { kind: "image", index: 1, image: "b" },
      { kind: "done" },
    ]);
  });

  it("index 만 있고 image 없음 → 이벤트 생성 안 함", () => {
    const { events } = feedChunk("", `data: {"index":0}\n`);
    expect(events).toEqual([]);
  });
});
