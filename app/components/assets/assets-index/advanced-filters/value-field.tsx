import Input from "~/components/forms/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/forms/select";
import type { Filter } from "./types";

export function ValueField({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (value: Filter["value"]) => void;
}) {
  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setFilter(event.target.value);
  }

  function handleBooleanChange(value: "true" | "false") {
    setFilter(value === "true");
  }

  function handleDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFilter(event.target.value);
  }

  function handleBetweenDateChange(index: 0 | 1) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [
        ...(Array.isArray(filter.value) ? filter.value : [null, null]),
      ];
      newValue[index] = event.target.value;
      setFilter(newValue);
    };
  }

  switch (filter.type) {
    case "string":
    case "text":
      return (
        <Input
          type="text"
          value={filter.value}
          onChange={handleChange}
          placeholder="Enter value"
          inputClassName="px-4 py-2 text-[14px] leading-5"
          hideLabel
          label={filter.name}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={filter.value}
          onChange={handleChange}
          placeholder="Enter number"
          inputClassName="px-4 py-2 text-[14px] leading-5"
          hideLabel
          label={filter.name}
        />
      );

    case "boolean":
      return (
        <Select
          value={filter.value?.toString()}
          onValueChange={handleBooleanChange}
        >
          <SelectTrigger className="text-left text-base text-gray-500 md:mt-0 md:max-w-fit">
            <SelectValue placeholder="Select availability" />
          </SelectTrigger>

          <SelectContent
            className=" w-full min-w-[250px] p-0 z-[999999]"
            position="popper"
            align="end"
          >
            <div className="max-h-[320px] overflow-auto">
              <SelectItem
                value={"true"}
                key={"true"}
                className="rounded-none border-b border-gray-200 px-6 py-4 pr-[5px]"
              >
                <span className="mr-4 block lowercase text-gray-700 first-letter:uppercase">
                  True
                </span>
              </SelectItem>
              <SelectItem
                value={"false"}
                key={"false"}
                className="rounded-none border-b border-gray-200 px-6 py-4 pr-[5px]"
              >
                <span className="mr-4 block lowercase text-gray-700 first-letter:uppercase">
                  False
                </span>
              </SelectItem>
            </div>
          </SelectContent>
        </Select>
      );

    case "date":
      if (filter.operator === "between") {
        return (
          <>
            <Input
              label="Start Date"
              type="datetime-local"
              value={Array.isArray(filter.value) ? filter.value[0] : ""}
              onChange={handleBetweenDateChange(0)}
              inputClassName="px-4 py-2 text-[14px] leading-5"
              hideLabel
            />
            <Input
              label="End Date"
              type="datetime-local"
              value={Array.isArray(filter.value) ? filter.value[1] : ""}
              onChange={handleBetweenDateChange(1)}
              inputClassName="px-4 py-2 text-[14px] leading-5"
              hideLabel
            />
          </>
        );
      } else {
        return (
          <Input
            label="Date"
            type="datetime-local"
            value={filter.value}
            onChange={handleDateChange}
            inputClassName="px-4 py-2 text-[14px] leading-5"
            hideLabel
          />
        );
      }

    case "enum":
      // const options = filter.options || [];
      return (
        <Select
          value={filter.value}
          onChange={handleChange}
          // options={options.map((option) => ({ value: option, label: option }))}
          placeholder="Select option"
        />
      );

    case "array":
      return (
        <Input
          type="text"
          label="Values"
          value={
            Array.isArray(filter.value) ? filter.value.join(", ") : filter.value
          }
          onChange={(e) =>
            setFilter(e.target.value.split(",").map((item) => item.trim()))
          }
          placeholder="Enter comma-separated values"
          inputClassName="px-4 py-2 text-[14px] leading-5"
          hideLabel
        />
      );

    default:
      return null;
  }
}
