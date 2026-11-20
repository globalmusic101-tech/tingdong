declare module 'sql.js/dist/sql-wasm-browser.js' {
  const initSqlJs: (config: { locateFile: (file: string) => string }) => Promise<{ Database: new (data: Uint8Array) => { exec: (sql: string) => Array<{values: (string | number | null)[][]}>; close: () => void } }>;
  export default initSqlJs;
}
