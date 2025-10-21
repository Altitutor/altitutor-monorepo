"use client"

import * as React from "react"
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { enUS } from "date-fns/locale"
import { cn } from '../lib/cn'

import "react-big-calendar/lib/css/react-big-calendar.css"

const locales = {
  "en-US": enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

export interface CalendarEvent {
  id: string | number
  title: string
  start: Date
  end: Date
  allDay?: boolean
  resource?: unknown
}

interface CalendarProps {
  events: CalendarEvent[]
  onSelectEvent?: (event: CalendarEvent) => void
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] | string[] }) => void
  className?: string
  style?: React.CSSProperties
  defaultView?: View
  views?: View[]
  selectable?: boolean
}

export function Calendar({
  events,
  onSelectEvent,
  onSelectSlot,
  className,
  style,
  defaultView = "week",
  views = ["month", "week", "day", "agenda"],
  selectable = true,
}: CalendarProps) {
  return (
    <div className={cn("h-[600px]", className)} style={style}>
      <BigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        defaultView={defaultView}
        views={views}
        selectable={selectable}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        popup
        className="rounded-md border bg-background shadow-sm"
      />
    </div>
  )
} 