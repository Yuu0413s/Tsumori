import { describe, expect, mock, test } from "bun:test";
import { createHandleUnauthorized } from "./handle-unauthorized.js";
import { UnauthorizedError } from "./unauthorized-error.js";

describe("handleUnauthorized", () => {
  test("UnauthorizedError なら /login へリダイレクトする", () => {
    const redirect = mock(() => {});
    const handleUnauthorized = createHandleUnauthorized(redirect);

    handleUnauthorized(new UnauthorizedError());

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  test("それ以外のエラーではリダイレクトしない", () => {
    const redirect = mock(() => {});
    const handleUnauthorized = createHandleUnauthorized(redirect);

    handleUnauthorized(new Error("サーバーエラー"));

    expect(redirect).not.toHaveBeenCalled();
  });

  test("Error でない値（境界値）でもリダイレクトしない", () => {
    const redirect = mock(() => {});
    const handleUnauthorized = createHandleUnauthorized(redirect);

    handleUnauthorized("plain string");

    expect(redirect).not.toHaveBeenCalled();
  });
});
