import { Text, translate, useLanguage } from "@/lib/i18n";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Empty } from "./ui";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (r: T) => ReactNode;
  sort?: (r: T) => string | number;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  search,
  filters,
  pageSize = 10,
  onRowClick,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  search?: (r: T) => string;
  filters?: ReactNode;
  pageSize?: number;
  onRowClick?: (r: T) => void;
  empty?: string;
}) {
  useLanguage();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const data = useMemo(() => {
    let d = rows;
    if (q && search) {
      const n = q.toLowerCase();
      d = d.filter((r) => search(r).toLowerCase().includes(n));
    }
    if (sort && columns[sort.i].sort) {
      const f = columns[sort.i].sort;
      if (!f) return d;
      d = [...d].sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * sort.dir);
    }
    return d;
  }, [rows, q, sort, search, columns]);

  const pages = Math.max(1, Math.ceil(data.length / pageSize));
  const p = Math.min(page, pages - 1);
  const slice = data.slice(p * pageSize, p * pageSize + pageSize);

  return (
    <div className="space-y-3">
      {(search || filters) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {search && (
            <div className="relative sm:w-72">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder={translate("بحث…")}
                className="ps-9"
              />
            </div>
          )}
          {filters}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              {columns.map((c, i) => (
                <TableHead
                  key={c.header + i}
                  className={cn(
                    "text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap",
                    c.className,
                  )}
                >
                  {c.sort ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() =>
                        setSort((s) =>
                          s?.i === i ? { i, dir: s.dir === 1 ? -1 : 1 } : { i, dir: 1 },
                        )
                      }
                    >
                      {translate(c.header)} <ArrowUpDown className="size-3" />
                    </button>
                  ) : (
                    translate(c.header)
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Empty text={empty} />
                </TableCell>
              </TableRow>
            ) : (
              slice.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((c, i) => (
                    <TableCell key={i} className={cn("whitespace-nowrap", c.className)}>
                      {c.cell(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.length}
            {<Text>{" نتيجة — صفحة "}</Text>}
            {p + 1}/{pages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={p === 0} onClick={() => setPage(p - 1)}>
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={p >= pages - 1}
              onClick={() => setPage(p + 1)}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
