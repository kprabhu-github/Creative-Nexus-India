"use client";

// Full-screen month calendar (shadcn-styled). Renders a 7×5 grid with each
// day's events as a compact card on desktop and as event dots on mobile.
// The parent owns the data; this component only handles layout, navigation,
// and selection. Hook `onAddEvent` to wire the "+ New Event" CTA.

import * as React from "react";
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfToday,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  SearchIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface CalendarEvent {
  id: string | number;
  name: string;
  time: string;
  datetime: string;
}

export interface CalendarDay {
  day: Date;
  events: CalendarEvent[];
}

interface FullScreenCalendarProps {
  data: CalendarDay[];
  onAddEvent?: (selectedDay: Date) => void;
  onDayClick?: (day: Date) => void;
}

const colStartClasses = [
  "",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
];

export function FullScreenCalendar({
  data,
  onAddEvent,
  onDayClick,
}: FullScreenCalendarProps) {
  const today = startOfToday();
  const [selectedDay, setSelectedDay] = React.useState(today);
  const [currentMonth, setCurrentMonth] = React.useState(
    format(today, "MMM-yyyy"),
  );
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date());
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth)),
  });

  const previousMonth = () =>
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: -1 }), "MMM-yyyy"));
  const nextMonth = () =>
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: 1 }), "MMM-yyyy"));
  const goToToday = () => setCurrentMonth(format(today, "MMM-yyyy"));

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    onDayClick?.(day);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
              <h1 className="p-1 text-xs uppercase text-muted-foreground">
                {format(today, "MMM")}
              </h1>
              <div className="flex w-full items-center justify-center rounded-lg border bg-background p-0.5 text-lg font-bold">
                <span>{format(today, "d")}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-foreground">
                {format(firstDayCurrentMonth, "MMMM, yyyy")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(firstDayCurrentMonth, "MMM d, yyyy")} -{" "}
                {format(endOfMonth(firstDayCurrentMonth), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <Button variant="outline" size="icon" className="hidden lg:flex">
            <SearchIcon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>

          <Separator orientation="vertical" className="hidden h-6 lg:block" />

          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            <Button
              onClick={previousMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Navigate to previous month"
            >
              <ChevronLeftIcon size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button
              onClick={goToToday}
              className="w-full rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 md:w-auto"
              variant="outline"
            >
              Today
            </Button>
            <Button
              onClick={nextMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Navigate to next month"
            >
              <ChevronRightIcon size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />
          <Separator orientation="horizontal" className="block w-full md:hidden" />

          {onAddEvent && (
            <Button
              className="w-full gap-2 md:w-auto"
              onClick={() => onAddEvent(selectedDay)}
            >
              <PlusCircleIcon size={16} strokeWidth={2} aria-hidden="true" />
              <span>New Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="lg:flex lg:flex-auto lg:flex-col">
        <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6 lg:flex-none">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <div
              key={d}
              className={cn(i < 6 && "border-r", "py-2.5")}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="flex text-xs leading-6 lg:flex-auto">
          {/* Desktop */}
          <div className="hidden w-full border-x lg:grid lg:grid-cols-7 lg:grid-rows-5">
            {days.map((day, dayIdx) =>
              !isDesktop ? (
                <CompactDay
                  key={dayIdx}
                  day={day}
                  selectedDay={selectedDay}
                  firstDayCurrentMonth={firstDayCurrentMonth}
                  data={data}
                  onClick={() => selectDay(day)}
                />
              ) : (
                <div
                  key={dayIdx}
                  onClick={() => selectDay(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day)],
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "bg-accent/50 text-muted-foreground",
                    "relative flex flex-col border-b border-r cursor-pointer focus:z-10",
                    !isEqual(day, selectedDay) && "hover:bg-accent/75",
                  )}
                >
                  <header className="flex items-center justify-between p-2.5">
                    <button
                      type="button"
                      className={cn(
                        isEqual(day, selectedDay) && "text-primary-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          isSameMonth(day, firstDayCurrentMonth) &&
                          "text-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          !isSameMonth(day, firstDayCurrentMonth) &&
                          "text-muted-foreground",
                        isEqual(day, selectedDay) &&
                          isToday(day) &&
                          "border-none bg-primary",
                        isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          "bg-foreground",
                        (isEqual(day, selectedDay) || isToday(day)) &&
                          "font-semibold",
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs hover:border",
                      )}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>
                        {format(day, "d")}
                      </time>
                    </button>
                  </header>
                  <div className="flex-1 p-2.5">
                    {data
                      .filter((event) => isSameDay(event.day, day))
                      .map((d) => (
                        <div key={d.day.toString()} className="space-y-1.5">
                          {d.events.slice(0, 1).map((event) => (
                            <div
                              key={event.id}
                              className="flex flex-col items-start gap-1 rounded-lg border bg-muted/50 p-2 text-xs leading-tight"
                            >
                              <p className="font-medium leading-none">
                                {event.name}
                              </p>
                              <p className="leading-none text-muted-foreground">
                                {event.time}
                              </p>
                            </div>
                          ))}
                          {d.events.length > 1 && (
                            <div className="text-xs text-muted-foreground">
                              + {d.events.length - 1} more
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Mobile */}
          <div className="isolate grid w-full grid-cols-7 grid-rows-5 border-x lg:hidden">
            {days.map((day, dayIdx) => (
              <CompactDay
                key={dayIdx}
                day={day}
                selectedDay={selectedDay}
                firstDayCurrentMonth={firstDayCurrentMonth}
                data={data}
                onClick={() => selectDay(day)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactDay({
  day,
  selectedDay,
  firstDayCurrentMonth,
  data,
  onClick,
}: {
  day: Date;
  selectedDay: Date;
  firstDayCurrentMonth: Date;
  data: CalendarDay[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        isEqual(day, selectedDay) && "text-primary-foreground",
        !isEqual(day, selectedDay) &&
          !isToday(day) &&
          isSameMonth(day, firstDayCurrentMonth) &&
          "text-foreground",
        !isEqual(day, selectedDay) &&
          !isToday(day) &&
          !isSameMonth(day, firstDayCurrentMonth) &&
          "text-muted-foreground",
        (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
        "flex h-14 flex-col border-b border-r px-3 py-2 hover:bg-muted focus:z-10",
      )}
    >
      <time
        dateTime={format(day, "yyyy-MM-dd")}
        className={cn(
          "ml-auto flex size-6 items-center justify-center rounded-full",
          isEqual(day, selectedDay) &&
            isToday(day) &&
            "bg-primary text-primary-foreground",
          isEqual(day, selectedDay) &&
            !isToday(day) &&
            "bg-primary text-primary-foreground",
        )}
      >
        {format(day, "d")}
      </time>
      {data.filter((date) => isSameDay(date.day, day)).length > 0 && (
        <div>
          {data
            .filter((date) => isSameDay(date.day, day))
            .map((date) => (
              <div
                key={date.day.toString()}
                className="-mx-0.5 mt-auto flex flex-wrap-reverse"
              >
                {date.events.map((event) => (
                  <span
                    key={event.id}
                    className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  />
                ))}
              </div>
            ))}
        </div>
      )}
    </button>
  );
}
