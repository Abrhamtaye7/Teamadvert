import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { visibleNav } from "./app/nav";
import { can } from "./auth/permissions";
import { RequireAuth } from "./auth/RequireAuth";
import { useSession } from "./auth/session";
import { DataList } from "./components/ui/DataList";
import { money } from "./lib/format";
import { jobBalance, lineTotal, proformaTotals } from "./lib/totals";
import { escapeHtml, html } from "./print/html";

describe("print escaping", () => {
  it("escapes customer text so it can't inject markup into printouts", () => {
    const name = `<img src=x onerror="alert(1)">`;
    const out = html`<div>${name}</div>`.value;
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("keeps nested html fragments and arrays", () => {
    const rows = ["a<b", "c"].map((v) => html`<li>${v}</li>`);
    expect(html`<ul>${rows}</ul>`.value).toBe("<ul><li>a&lt;b</li><li>c</li></ul>");
  });
});

describe("totals (must match the API)", () => {
  it("applies 15% VAT by default, 0% as exempt, after discount", () => {
    expect(lineTotal({ quantity: 10, sellingPrice: 100 }).total).toBe(1150);
    expect(lineTotal({ quantity: 10, sellingPrice: 100, discount: 100 }).total).toBe(1035);
    expect(lineTotal({ quantity: 1, sellingPrice: 500, vatPercent: 0 }).total).toBe(500);
    expect(proformaTotals([{ quantity: 10, sellingPrice: 100 }, { quantity: 1, sellingPrice: 500, vatPercent: 0 }])).toEqual({ subtotal: 1500, discount: 0, vat: 150, total: 1650 });
  });

  it("computes job balances and never goes negative", () => {
    expect(jobBalance({ price: 1000, payments: [{ amount: 400 }, { amount: 250.5 }] })).toEqual({ price: 1000, paid: 650.5, balance: 349.5 });
    expect(jobBalance({ price: 100, payments: [{ amount: 150 }] }).balance).toBe(0);
    expect(money(1234.5)).toBe("ETB 1,234.50");
  });
});

describe("permissions and navigation", () => {
  const user = (role: string, access?: string[]) => ({ id: 1, username: "u", role, access });

  it("mirrors the API's role rules", () => {
    expect(can(user("Admin"), "proforma.approve")).toBe(true);
    expect(can(user("Sales"), "proforma.approve")).toBe(false);
    expect(can(user("Production"), "job.production")).toBe(true);
    expect(can(user("Finance"), "payment.record")).toBe(true);
    expect(can(null, "customer.edit")).toBe(false);
  });

  it("hides sections the user has no access to, but always shows Settings", () => {
    const nav = visibleNav(user("Sales", ["proformas", "customers"])).map((i) => i.label);
    expect(nav).toEqual(["Proformas", "Quote requests", "Customers", "Settings"]);
    expect(visibleNav(user("Production", ["customers"])).map((i) => i.label)).toEqual(["Customers", "Settings"]);
  });
});

describe("RequireAuth", () => {
  it("sends signed-out users to login, remembering the page they wanted", async () => {
    useSession.getState().clear();
    const router = createMemoryRouter(
      [
        { path: "/login", Component: () => <p>login page</p> },
        { element: <RequireAuth />, children: [{ path: "/jobs/:id", Component: () => <p>job page</p> }] },
      ],
      { initialEntries: ["/jobs/7?tab=pay"] },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(router.state.location.state).toEqual({ from: "/jobs/7?tab=pay" });
  });
});

describe("DataList", () => {
  it("renders a table for desktop and cards for phones from the same rows", () => {
    render(
      <DataList
        rows={[{ id: 1, name: "Flex banner" }]}
        rowKey={(r) => r.id}
        columns={[{ key: "name", header: "Name", cell: (r) => r.name }]}
        card={(r) => <span>card {r.name}</span>}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("card Flex banner")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(<DataList rows={[]} rowKey={() => 1} columns={[]} card={() => null} empty={<p>nothing yet</p>} />);
    expect(screen.getByText("nothing yet")).toBeInTheDocument();
  });
});
