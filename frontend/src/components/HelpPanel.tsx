export function HelpPanel() {
  return (
    <details className="help">
      <summary>How to read this</summary>
      <div className="help__body">
        <p>
          Each day, before delivery, the buying team must buy the power that wind will not cover. This page shows the
          wind forecast they could actually see at that moment, and how wrong such forecasts have been.
        </p>
        <ul>
          <li>
            <strong>Decision deadline</strong>: for every hour of a delivery day, we use the latest forecast published by
            your cut-off time (UK) on the <em>day before</em>. This matches the real buying routine.
          </li>
          <li>
            <strong>Forecast horizon</strong>: for every hour, we use the latest forecast published at least N hours
            earlier. Use this to see how accuracy changes the further ahead you look.
          </li>
          <li>
            <strong>Error</strong> = forecast minus actual. A positive error means the forecast was <em>too high</em>: less
            wind came than expected, so you would be <strong>short</strong> of power. This is the risky side.
          </li>
          <li>All power values are in GW (1 GW = 1,000 MW). Times are UK local time unless marked UTC.</li>
          <li>Every setting is saved in the page link, so you can copy the address and share the exact view.</li>
        </ul>
      </div>
    </details>
  );
}
