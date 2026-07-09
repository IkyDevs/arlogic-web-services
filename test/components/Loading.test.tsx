import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Loading } from "@/components/ui/Loading";

describe("Loading Component", () => {
  it("renders loading spinner", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows loading text", () => {
    render(<Loading text="Memuat data..." />);
    expect(screen.getByText("Memuat data...")).toBeInTheDocument();
  });

  it("uses default text when not provided", () => {
    render(<Loading />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it.todo("renders pending status correctly");
  it.todo("renders completed status correctly");
  it.todo("renders cancelled status correctly");
});
