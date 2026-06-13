# Mac print-agent setup

Files in this folder are for **macOS** warehouse Macs. Windows USB kit scripts live at the **repo root** (`INSTALL TO THIS PC.bat`, etc.).

## IT — one-time install (no Terminal for staff after this)

1. Install **Node.js 22 LTS** and plug in the label printer.
2. Run `lpstat -a` and set `usbPrinterName` in `print-agent.config.json` (parent folder).
3. Add your admin URL to `corsOrigins` if not printing from localhost.
4. From this folder:

```bash
chmod +x install-mac-service.sh
./install-mac-service.sh
```

That registers a background service: starts at login, restarts if it crashes.

5. Admin → **Settings → Printer** → set this PC's location → test label.

Full guide: [IT-SETUP-GUIDE.md](../../IT-SETUP-GUIDE.md) at repo root.

## Staff — daily use

See **WAREHOUSE-STAFF-MAC.txt**. No Terminal — log in and print from the website.

## Manual start (testing only)

```bash
./start-print-agent.sh
```

Keep the terminal open. For production staff Macs, use `install-mac-service.sh` instead.

## Files

| File | Purpose |
|------|---------|
| `install-mac-service.sh` | One-time background install (launchd) |
| `WAREHOUSE-STAFF-MAC.txt` | Plain instructions for warehouse staff |
| `start-print-agent.sh` | Manual start for IT testing |
