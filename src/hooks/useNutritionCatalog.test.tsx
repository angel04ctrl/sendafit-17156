import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useNutritionCatalog";

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("espera antes de publicar una búsqueda nueva", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "huevo" } },
    );

    rerender({ value: "salmón" });
    expect(result.current).toBe("huevo");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("salmón");
  });

  it("ignora temporizadores obsoletos al escribir rápido", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "h" } },
    );

    rerender({ value: "hu" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: "huevo" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("h");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("huevo");
  });
});
