// Test that multiline editor correctly handles combined sequences of events
// and only calls onSubmit once per submission

import { renderTui } from "./ui-test-helpers";
import MultilineTextEditor from "../src/components/chat/multiline-editor";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";

async function type(
  stdin: NodeJS.WritableStream,
  text: string,
  flush: () => Promise<void>,
) {
  stdin.write(text);
  await flush();
}

describe("MultilineTextEditor – Combined input sequences", () => {
  it("only calls onSubmit once when CSI-u and \\r are received in sequence", async () => {
    const onSubmit = vi.fn();

    const { stdin, flush, cleanup } = renderTui(
      React.createElement(MultilineTextEditor, {
        height: 5,
        width: 20,
        onSubmit,
      }),
    );

    await flush();

    // Type some text
    await type(stdin, "hello", flush);
    
    // Send Ctrl+Enter as CSI sequence, immediately followed by \r
    await type(stdin, "\u001B[13;5u", flush); // Ctrl+Enter
    await type(stdin, "\r", flush); // Plain Enter
    
    await flush();

    // onSubmit should only be called once, not twice
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toBe("hello");

    cleanup();
  });

  it("only calls onSubmit once when key.return and \\r are received in sequence", async () => {
    const onSubmit = vi.fn();

    const { stdin, flush, cleanup } = renderTui(
      React.createElement(MultilineTextEditor, {
        height: 5,
        width: 20,
        onSubmit,
      }),
    );

    await flush();

    // Type some text
    await type(stdin, "world", flush);
    
    // Simulate key.return event (this is handled by the component's key event handler)
    // and then immediately send \r (which could come from the terminal)
    await type(stdin, "\r", flush); // First Enter (\r) - should trigger key.return
    await type(stdin, "\r", flush); // Second Enter (\r) - should be ignored since submitHandled=true
    
    await flush();

    // onSubmit should only be called once, not twice
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toBe("world");

    cleanup();
  });
}); 