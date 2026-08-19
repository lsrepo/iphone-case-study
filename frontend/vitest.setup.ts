import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/navigation's useRouter() throws unless it's rendered inside a real
// Next.js App Router tree, which unit tests don't provide. Stub it globally
// so pages that call useRouter() can be rendered directly with Testing
// Library without every test needing its own next/navigation mock.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
