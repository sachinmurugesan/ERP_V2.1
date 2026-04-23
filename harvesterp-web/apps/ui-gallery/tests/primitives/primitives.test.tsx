/**
 * Primitive smoke tests — one mount-without-crash test per shadcn primitive.
 * Shadcn components are copy-paste canonical; extensive testing is skipped.
 * These tests exist purely to register coverage and catch import errors.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Textarea } from "@/components/primitives/textarea";
import { Badge } from "@/components/primitives/badge";
import { Skeleton } from "@/components/primitives/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/primitives/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitives/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { Checkbox } from "@/components/primitives/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/primitives/tabs";

describe("Button primitive", () => {
  it("renders without crash", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
  it("renders destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
  it("is disabled when prop set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("Input primitive", () => {
  it("renders without crash", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });
  it("renders disabled state", () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });
});

describe("Textarea primitive", () => {
  it("renders without crash", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });
});

describe("Badge primitive", () => {
  it("renders without crash", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
  it("renders destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});

describe("Skeleton primitive", () => {
  it("renders without crash", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("Alert primitive", () => {
  it("renders without crash", () => {
    render(
      <Alert>
        <AlertTitle>Test</AlertTitle>
        <AlertDescription>Description</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
  it("has role=alert", () => {
    render(<Alert>Content</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("Card primitive", () => {
  it("renders without crash", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Total</CardTitle>
        </CardHeader>
        <CardContent>₹4,20,000</CardContent>
      </Card>,
    );
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("₹4,20,000")).toBeInTheDocument();
  });
});

describe("Table primitive", () => {
  it("renders without crash", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>ORD-001</TableCell>
            <TableCell>₹1,000</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("ORD-001")).toBeInTheDocument();
  });
});

describe("Checkbox primitive", () => {
  it("renders without crash", () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});

describe("Tabs primitive", () => {
  it("renders without crash", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Tab A")).toBeInTheDocument();
    expect(screen.getByText("Content A")).toBeInTheDocument();
  });
});
