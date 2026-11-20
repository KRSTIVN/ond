import type { Temporal as TemporalApi } from 'temporal-polyfill';

declare global {
  // eslint-disable-next-line no-var
  var Temporal: typeof TemporalApi;

  namespace Temporal {
    export type PlainDate = TemporalApi.PlainDate;
    export type PlainTime = TemporalApi.PlainTime;
    export type PlainDateTime = TemporalApi.PlainDateTime;
    export type PlainYearMonth = TemporalApi.PlainYearMonth;
    export type PlainMonthDay = TemporalApi.PlainMonthDay;
    export type ZonedDateTime = TemporalApi.ZonedDateTime;
    export type Instant = TemporalApi.Instant;
    export type Duration = TemporalApi.Duration;
  }
}

export {};
