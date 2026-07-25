"use client";

import { Select, type SelectOption } from "@shared/ui/Select";

const ALL_VALUE = "all";

export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options: SelectOption[] = [
    { value: ALL_VALUE, label: "전체 카테고리" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  return <Select value={value} onChange={onChange} options={options} placeholder="전체 카테고리" />;
}

export { ALL_VALUE as CATEGORY_FILTER_ALL };
