# Installing BUMP RUN on a Fire TV / Fire Stick

## 1. Enable developer options

On the Fire TV remote:

1. **Settings -> My Fire TV -> About**.
2. Click/select the device name **7 times** until it says "You are now a developer!"
3. Go back to **My Fire TV -> Developer options**.
4. Turn on **ADB debugging**.
5. Turn on **Apps from Unknown Sources** (needed to sideload).

## 2. Find the Fire TV's IP address

**Settings -> My Fire TV -> About -> Network** shows the current IP (e.g.
`192.168.1.123`). It's on the same screen as the developer-options toggle above.

## 3. Connect via ADB from Windows

Make sure `adb` is on your PATH (it ships with the Android SDK's `platform-tools`,
e.g. `C:\Android\Sdk\platform-tools`), then:

```powershell
adb connect 192.168.1.123:5555
```

You should see `connected to 192.168.1.123:5555`. If it hangs, double check the
Fire TV and PC are on the same Wi-Fi network and that ADB debugging is still on.

## 4. Install the APK

Build it first if you haven't:

```powershell
pnpm run apk:debug
```

Then either use the helper script:

```powershell
.\scripts\install-firetv.ps1 -DeviceIp 192.168.1.123
```

...or run adb directly:

```powershell
adb -s 192.168.1.123:5555 install -r apps\tv\app\build\outputs\apk\debug\app-debug.apk
```

`-r` reinstalls/updates in place, so re-running this after every rebuild is safe.

## 5. Launch it

Find **BUMP RUN** under **Apps & Channels** on the Fire TV home screen (it
registers as a proper Leanback launcher app, so it shows up there -- not just in
a generic "sideloaded apps" folder).

## 6. Point it at your server

First launch: go to **SETTINGS** and enter your PC's LAN URL (printed by
`pnpm run dev:lan`, e.g. `http://192.168.1.50:3000`). This is saved locally.

## Viewing logs

```powershell
adb -s 192.168.1.123:5555 logcat --pid=$(adb -s 192.168.1.123:5555 shell pidof -s com.bumprun.tv)
```

Or more simply, filter by tag/package in a wider logcat stream:

```powershell
adb -s 192.168.1.123:5555 logcat | Select-String "bumprun"
```

## Uninstalling

```powershell
adb -s 192.168.1.123:5555 uninstall com.bumprun.tv
```

## Troubleshooting

- **"adb: more than one device/emulator"** -- disconnect other ADB sessions
  (`adb disconnect`) or target this one explicitly with `-s 192.168.1.123:5555`.
- **Connection refused on port 5555** -- ADB debugging was turned off, or the
  device's IP changed (DHCP). Re-check Settings -> About -> Network.
- **App installs but crashes immediately** -- check `adb logcat` for a stack
  trace; the most common cause during development is an unreachable/misconfigured
  server URL in Settings.
