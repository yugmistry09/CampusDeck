import { ipcMain } from 'electron'
import {
  assertTrustedSender,
  parseOrThrow,
  calendarEventCreateSchema,
  calendarEventUpdateSchema,
  calendarEventIdSchema,
  calendarEventTaskSchema,
  calendarEventBetweenSchema
} from './validation'
import type { CalendarEventRepo } from '../db/repositories/calendarEvents'

export function registerCalendarEventHandlers(repo: CalendarEventRepo): void {
  ipcMain.handle('calendar-event:create', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.create(parseOrThrow(calendarEventCreateSchema, payload))
  })

  ipcMain.handle('calendar-event:get', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(calendarEventIdSchema, payload)
    return repo.getById(id)
  })

  ipcMain.handle('calendar-event:list-all', (event) => {
    assertTrustedSender(event.sender)
    return repo.listAll()
  })

  ipcMain.handle('calendar-event:list-by-task', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { taskId } = parseOrThrow(calendarEventTaskSchema, payload)
    return repo.listByTask(taskId)
  })

  ipcMain.handle('calendar-event:list-between', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const input = parseOrThrow(calendarEventBetweenSchema, payload)
    return repo.listBetween(input.startAt, input.endAt)
  })

  ipcMain.handle('calendar-event:update', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    return repo.update(parseOrThrow(calendarEventUpdateSchema, payload))
  })

  ipcMain.handle('calendar-event:delete', (event, payload: unknown) => {
    assertTrustedSender(event.sender)
    const { id } = parseOrThrow(calendarEventIdSchema, payload)
    repo.delete(id)
  })
}
