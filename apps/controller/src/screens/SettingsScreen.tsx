import { useState } from "react";
import { getSettings, updateSettings } from "../lib/settings.js";

export function SettingsScreen(props: { onClose: () => void }) {
  const [settings, setSettings] = useState(getSettings());

  function toggle(key: "soundEnabled" | "vibrationEnabled") {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    updateSettings({ [key]: next[key] });
  }

  return (
    <div className="screen">
      <div className="logo" style={{ fontSize: "1.6rem" }}>
        Settings
      </div>

      <div className="settings-list">
        <div className="settings-row">
          <span>Sound effects</span>
          <button className={`toggle-btn${settings.soundEnabled ? " on" : ""}`} onClick={() => toggle("soundEnabled")}>
            {settings.soundEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="settings-row">
          <span>Vibration</span>
          <button className={`toggle-btn${settings.vibrationEnabled ? " on" : ""}`} onClick={() => toggle("vibrationEnabled")}>
            {settings.vibrationEnabled ? "On" : "Off"}
          </button>
        </div>
      </div>

      <button className="btn-secondary" onClick={props.onClose}>
        Back
      </button>
    </div>
  );
}
