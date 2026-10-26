import type { ReactNode } from "react";
import styles from "./admin-skeleton.module.css";

function Block({ className = "" }: { className?: string }) {
  return <span className={`${styles.block} ${className}`} />;
}

function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className={styles.content} aria-busy="true" aria-hidden="true">
        {children}
      </div>
    </>
  );
}

function Stats({ finance = false }: { finance?: boolean }) {
  return (
    <div className={finance ? "finance-stats" : "admin-stats"}>
      {Array.from({ length: finance ? 6 : 3 }, (_, index) => (
        <div className={`panel stat-card ${styles.stat}`} key={index}>
          <Block className={styles.label} />
          <Block className={styles.value} />
          {finance && <Block className={styles.label} />}
        </div>
      ))}
    </div>
  );
}

function CalendarGrid() {
  return (
    <div className={`availability-grid ${styles.calendar}`}>
      <div className="availability-header">
        {[0, 1, 2].map((column) => (
          <div key={column}>
            <Block className={styles.label} />
          </div>
        ))}
      </div>
      {Array.from({ length: 10 }, (_, row) => (
        <div className="availability-row" key={row}>
          <div className="time-label">
            <Block />
          </div>
          {[1, 2].map((court) => (
            <div className="slot-cell" key={court}>
              <Block className={styles.slot} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AdminCalendarSkeleton() {
  return (
    <LoadingRegion label="Loading court calendar…">
      <div className="admin-header">
        <Block className={styles.title} />
        <Block className={styles.action} />
      </div>
      <Stats />
      <div className={`admin-toolbar ${styles.toolbar}`}>
        <Block className={styles.date} />
        <div className={styles.dateField}>
          <Block className={styles.label} />
          <Block className={styles.input} />
        </div>
      </div>
      <CalendarGrid />
      <div className={`panel ${styles.review}`}>
        <Block className={styles.title} />
        <Block className={styles.line} />
      </div>
    </LoadingRegion>
  );
}

export function AdminFinanceSkeleton() {
  return (
    <LoadingRegion label="Loading finance reports…">
      <div className="finance-heading">
        <Block className={styles.title} />
        <Block className={styles.action} />
      </div>
      <div className={`finance-toolbar ${styles.toolbar}`}>
        <div className={styles.dateField}>
          <Block className={styles.label} />
          <Block className={styles.title} />
        </div>
        <Block className={styles.input} />
      </div>
      <Stats finance />
      <div className={styles.reportNote}>
        <Block className={styles.line} />
      </div>
      <div className={`panel ${styles.report}`}>
        {Array.from({ length: 7 }, (_, row) => (
          <div className={styles.reportRow} key={row}>
            {Array.from({ length: 4 }, (_, column) => (
              <Block key={column} />
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <LoadingRegion label="Loading venue settings…">
      <div className={`panel schedule-editor ${styles.settings}`}>
        <Block className={styles.title} />
        <Block className={styles.line} />
        <div className="field-grid">
          {Array.from({ length: 4 }, (_, field) => (
            <div className={styles.settingField} key={field}>
              <Block className={styles.label} />
              <Block className={styles.input} />
            </div>
          ))}
        </div>
        <Block className={styles.action} />
      </div>
      <div className="settings-layout">
        <div className={`panel ${styles.settings}`}>
          <Block className={styles.title} />
          <Block className={styles.date} />
          {Array.from({ length: 5 }, (_, field) => (
            <div className={styles.settingField} key={field}>
              <Block className={styles.label} />
              <Block className={styles.input} />
            </div>
          ))}
        </div>
        <div className={`panel ${styles.settings}`}>
          <Block className={styles.title} />
          {Array.from({ length: 6 }, (_, item) => (
            <Block className={styles.line} key={item} />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
