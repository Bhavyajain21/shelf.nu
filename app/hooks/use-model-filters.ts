import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useSearchParams } from "~/hooks/search-params";
import { type loader, type ModelFilters } from "~/routes/api+/model-filters";
import { transformItemUsingTransformer } from "~/utils/model-filters";
import useFetcherWithReset from "./use-fetcher-with-reset";

export type ModelFilterItem = {
  id: string;
  name: string;
  color?: string;
  user?: User;
  metadata: Record<string, any>;
};

export type ModelFilterProps = {
  defaultValues?: string[];
  /** name of key in loader which is used to pass initial data */
  initialDataKey: string;
  /** name of key in loader which passing the total count */
  countKey: string;
  model: ModelFilters;
  /** If none is passed then values will not be added in query params */
  selectionMode?: "append" | "set" | "none";
  /**
   * A function to transform an item on basis of item data
   * @example
   * transformItem: (item) => ({ ...item, id: JSON.stringify({ id: item.id, name: item.name }) })
   */
  transformItem?: (item: ModelFilterItem) => ModelFilterItem;
  onSelectionChange?: (selectedIds: string[]) => void;
};

const GET_ALL_KEY = "getAll";

/**
 * Determines if all data for the model is loaded
 */
function isAllDataLoaded(
  items: ModelFilterItem[],
  totalItems: number
): boolean {
  return items.length === totalItems && totalItems > 0;
}

/**
 * Performs client-side filtering of items
 */
function filterItemsLocally(
  items: ModelFilterItem[],
  query: string
): ModelFilterItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return items;

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(normalizedQuery) ||
      Object.values(item.metadata || {}).some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(normalizedQuery)
      )
  );
}

export function useModelFilters({
  defaultValues,
  model,
  countKey,
  initialDataKey,
  selectionMode = "append",
  transformItem,
  onSelectionChange,
}: ModelFilterProps) {
  const initialData = useLoaderData<any>();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItems, setSelectedItems] = useState<string[]>(
    defaultValues ?? []
  );

  const fetcher = useFetcherWithReset<SerializeFrom<typeof loader>>();
  const totalItems = initialData[countKey];

  // Track if all data is loaded
  const hasAllData = useMemo(
    () =>
      isAllDataLoaded(
        transformItemUsingTransformer(
          initialData[initialDataKey],
          transformItem
        ),
        totalItems
      ),
    [initialData, initialDataKey, totalItems, transformItem]
  );

  useEffect(
    function updateSelectedValuesWhenParamsChange() {
      if (selectionMode === "none") {
        let filteringParams = searchParams.get("custody");
        if (filteringParams) {
          filteringParams = filteringParams.split(":")[1];
          const ids = filteringParams.split(",");
          setSelectedItems(ids);
        }
      } else {
        setSelectedItems(searchParams.getAll(model.name));
      }
    },
    [model.name, searchParams, selectionMode]
  );
  const items = useMemo(() => {
    const baseItems =
      searchQuery && fetcher.data && !fetcher.data.error
        ? fetcher.data.filters
        : initialData[initialDataKey];

    const transformedItems = transformItemUsingTransformer(
      baseItems,
      transformItem
    );

    // Use client-side filtering if all data is loaded
    return hasAllData && searchQuery
      ? filterItemsLocally(transformedItems, searchQuery)
      : transformedItems;
  }, [
    fetcher.data,
    initialData,
    initialDataKey,
    searchQuery,
    transformItem,
    hasAllData,
  ]);

  const handleSelectItemChange = useCallback(
    (value: string) => {
      if (selectionMode === "none") {
        const newSelected = selectedItems.includes(value)
          ? selectedItems.filter((id) => id !== value)
          : [...selectedItems, value];
        setSelectedItems(newSelected);
        onSelectionChange?.(newSelected);
        return;
      }

      if (selectedItems.includes(value)) {
        setSelectedItems((prev) => prev.filter((item) => item !== value));
        setSearchParams((prev) => {
          prev.delete(model.name, value);
          return prev;
        });
      } else {
        setSelectedItems((prev) => [...prev, value]);
        setSearchParams(
          (prev) => {
            if (selectionMode === "append") {
              prev.append(model.name, value);
            } else {
              prev.set(model.name, value);
            }
            return prev;
          },
          { preventScrollReset: true }
        );
      }
    },
    [
      selectedItems,
      onSelectionChange,
      selectionMode,
      setSearchParams,
      model.name,
    ]
  );

  const handleSearchQueryChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!e.currentTarget.value) {
      clearFilters();
    } else {
      setSearchQuery(e.currentTarget.value);

      // Only fetch from server if we don't have all data
      if (!hasAllData) {
        fetcher.submit(
          {
            ...model,
            queryValue: e.currentTarget.value,
            selectedValues: selectedItems,
          },
          {
            method: "GET",
            action: "/api/model-filters",
          }
        );
      }
    }
  };

  const resetModelFiltersFetcher = () => {
    setSearchQuery("");
    fetcher.reset();
  };

  const clearFilters = () => {
    setSelectedItems([]);
    resetModelFiltersFetcher();

    if (selectionMode !== "none") {
      setSearchParams((prev) => {
        prev.delete(model.name);
        return prev;
      });
    }
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  function getAllEntries() {
    const value = model.name;
    if (searchParams.has(GET_ALL_KEY, value)) {
      setSearchParams((prev) => {
        prev.delete(GET_ALL_KEY, value);
        return prev;
      });
    } else {
      setSearchParams((prev) => {
        prev.append(GET_ALL_KEY, value);
        return prev;
      });
    }
  }

  function handleSelectAll() {
    setSelectedItems(items.map((i) => i.id));

    if (selectionMode === "none") {
      return;
    }

    setSearchParams((prev) => {
      if (selectionMode === "append") {
        prev.delete(model.name);
        items.forEach((i) => prev.append(model.name, i.id));
      } else {
        prev.set(model.name, items[0].id);
      }
      return prev;
    });
  }

  return {
    searchQuery,
    setSearchQuery,
    totalItems,
    items,
    selectedItems,
    handleSelectItemChange,
    handleSearchQueryChange,
    resetModelFiltersFetcher,
    clearFilters,
    getAllEntries,
    handleSelectAll,
  };
}
