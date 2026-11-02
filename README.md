# Minimap for Bedrock

Eine Minimap für **Minecraft Bedrock Edition** im Stil von *Xaero's Minimap*: ein Add-on aus Behavior Pack und Resource Pack, ohne externe Tools und ohne Client-Mods.

## Features

| Feature | Beschreibung |
| --- | --- |
| Terrain-Karte | Echte Blockfarben (64 Grundfarben) mit Höhenschattierung wie bei Vanilla-Karten. Wasser wird nach Tiefe schattiert. |
| Höhlenmodus | Schaltet unter der Erde und im Nether automatisch um und zeigt dann die Ebene, auf der du stehst. Lässt sich auf *Auto / Aus / Immer* stellen. |
| Rotation | Die Karte ist entweder nach Norden ausgerichtet oder dreht sich mit deiner Blickrichtung. Im gedrehten Modus zeigt ein **N** am Rand nach Norden. |
| Zoom | 1, 2, 4, 8 oder 16 Blöcke pro Kartenfeld |
| Entity-Radar | Spieler (weiß), feindliche Mobs (rot) und friedliche Mobs (grün), jeweils einzeln abschaltbar |
| Wegpunkte | Bis zu 100 pro Spieler, 16 Farben, mit Dimension. Du kannst sie ein- und ausblenden, bearbeiten, löschen, im Chat teilen und als Operator dorthin teleportieren. Wegpunkte außerhalb der Karte erscheinen am Rand. |
| Wegpunkt verfolgen | Zeigt Entfernung und einen Richtungspfeil unter der Karte |
| Todespunkte | Beim Tod wird automatisch ein Wegpunkt „Tod“ gesetzt (✕-Symbol). |
| Infozeilen | Koordinaten, Himmelsrichtung und Grad, Zoomstufe, Biom und optional die Uhrzeit |
| Große Karte | Eine größere Karte in der Bildschirmmitte mit eigenem Zoom (z. B. 61×41 Felder) |
| Position & Größe | Oben rechts oder oben links, 17 bis 41 Felder |
| Sprache | Deutsch und Englisch |
| Multiplayer | Einstellungen und Wegpunkte werden pro Spieler in der Welt gespeichert. |

## Installation

1. `dist/MinimapForBedrock.mcaddon` herunterladen und öffnen (Doppelklick). Minecraft importiert dann beide Packs.
2. In den Welteinstellungen das **Verhaltenspaket** *Minimap for Bedrock (BP)* aktivieren. Das Ressourcenpaket wird automatisch mit aktiviert.
3. Voraussetzung ist Minecraft Bedrock **1.21.80 oder neuer**. Experimentelle Features sind nicht nötig.

Beim ersten Betreten der Welt bekommst du das **Minimap-Item**. Du kannst es auch aus *Kompass + Papier* craften.

## Bedienung

| Aktion | Wirkung |
| --- | --- |
| Minimap-Item benutzen | Hauptmenü (ein-/ausblenden, große Karte, Wegpunkte, Einstellungen, Zoom) |
| Schleichen + Item benutzen | Große Karte öffnen oder schließen |
| `/minimap:menu` | Hauptmenü |
| `/minimap:settings` | Einstellungen |
| `/minimap:waypoints` | Wegpunktliste |
| `/minimap:waypoint [Name]` | Wegpunkt an der aktuellen Position setzen |
| `/minimap:toggle` | Minimap ein- oder ausblenden |
| `/minimap:large` | Große Karte umschalten |
| `/minimap:zoom [Blöcke]` | Zoom setzen (1/2/4/8/16), ohne Wert herauszoomen |

## Wie es funktioniert

Bedrock lässt keine echten Client-Mods zu. Die Minimap kombiniert deshalb drei offizielle Add-on-Techniken:

1. **Script API** (`@minecraft/server`): `behavior_pack/scripts/terrain.js` liest die Spalten rund um den Spieler aus (`getTopmostBlock`, im Höhlenmodus `getBlock`). Die Ergebnisse landen in einem Cache. Das Scannen hat ein festes Budget pro Tick (900 Block-Abfragen bzw. 6 ms), damit der Server nicht laggt. Nahe Spalten werden zuerst gescannt.
2. **Eigene Font-Glyphen**: `resource_pack/font/glyph_E1.png` enthält 256 einfarbige Quadrate (64 Farben × 4 Helligkeitsstufen) auf den Unicode-Zeichen `U+E100–U+E1FF`. `glyph_E2.png` enthält Icons wie Pfeile, Mob-Punkte und Wegpunkte. Die Karte wird als Text aus diesen Zeichen gebaut (`renderer.js`).
3. **JSON UI**: Der Text wird als Titel mit einem Marker (`MINIMAP_TR:` usw.) gesendet. `resource_pack/ui/hud_screen.json` blendet ihn in der Ecke als Minimap ein, zeigt den Untertitel als Infozeilen darunter und versteckt dabei den normalen Titel.

### Projektstruktur

```
behavior_pack/
  manifest.json, items/, recipes/
  scripts/
    main.js         Update-Loop, Events, Befehle
    renderer.js     Karte -> Glyphen-Text, Overlays, Infozeilen
    terrain.js      Spalten-Scan, Cache, Höhlenmodus
    blockColors.js  Block-ID -> Kartenfarbe
    palette.js      Farben, Icons, Marker (auch vom Generator genutzt)
    settings.js     Einstellungen und Wegpunkte (Dynamic Properties)
    ui.js           Menüs (server-ui)
    lang.js         Deutsch / Englisch
resource_pack/
  font/glyph_E1.png, glyph_E2.png
  ui/hud_screen.json
  textures/…
tools/
  generate.js       erzeugt alle PNGs und hud_screen.json aus palette.js
  selftest.js       Offline-Test des Renderers mit simulierter Welt
  build.py          packt dist/*.mcaddon / *.mcpack
```

### Entwickeln

```bash
npm run generate   # Texturen und hud_screen.json neu erzeugen (nach Palettenänderungen)
npm test           # Offline-Test (Node 22+), optional: node tools/selftest.js preview.png
npm run build      # generate + dist/MinimapForBedrock.mcaddon bauen
```

Eine neue Blockfarbe trägst du in `blockColors.js` ein. Eine neue Grundfarbe gehört in `palette.js` (maximal 64), danach `npm run build` ausführen.

## Bekannte Einschränkungen

- Die Karte wird über den **Titel-Kanal** angezeigt. Wenn eine andere Welt oder ein anderes Add-on `/title` benutzt, verschwindet die Minimap kurz.
- Je nach Plattform und GUI-Skalierung können zwischen den Kartenpixeln feine Lücken entstehen, weil Bedrock Glyphen mit Zeichenabstand rendert. Die Kartengröße steuert `font_scale_factor` in `tools/generate.js` (Standard `0.5`).
- Die Karte zeigt nur, was der Server geladen hat (Simulationsdistanz). Weiter entfernte Bereiche erscheinen dunkel.
- Biomnamen erscheinen nur, wenn deine Minecraft-Version `Dimension.getBiome` anbietet.
- Teleportieren zu Wegpunkten ist nur für Operatoren möglich.
