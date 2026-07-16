// Procedurally-drawn glyph icons for built-in layer templates. No external
// image files, no trademark/logo risk - each glyph is a simple symbolic
// shape (play triangle, record dot, etc.) drawn in a contrasting color over
// the button's own background color, then run through the exact same
// conversion pipeline a user-uploaded image goes through (icon.js's
// rgbaToRgb565 + computeIconId). The result is indistinguishable from an
// uploaded icon to the rest of the system - no new wire format, no firmware
// change, no BLE protocol change. Implements:
//   openspec/changes/add-layer-templates/specs/webapp-layer-templates/spec.md

import { ICON_WIDTH, ICON_HEIGHT, rgbaToRgb565, computeIconId } from "./icon.js";

const CENTER = ICON_WIDTH / 2;
const R = ICON_WIDTH * 0.28; // typical glyph "radius" - consistent visual weight

// Every valid iconGlyph name a template button can reference - templates.test.js
// checks every template's iconGlyph is in this list, catching typos early.
export const GLYPH_NAMES = [
  "play",
  "stop",
  "record",
  "rewind",
  "forward",
  "toStart",
  "skipNext",
  "cycle",
  "save",
  "restart",
  "undo",
  "metronome",
  "tapTempo",
  "stream",
  "scene",
  "volumeUp",
  "volumeDown",
  "mute",
  "pointer",
  "pencil",
  "eraser",
  "scissors",
  "marquee",
  "markIn",
  "markOut",
  "split",
  "appLauncher",
];

// WCAG-ish relative luminance - picks a legible foreground for whatever
// background color the template button already has.
export function contrastColor(hex) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

function triRight(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy - r);
  ctx.lineTo(cx - r * 0.6, cy + r);
  ctx.lineTo(cx + r * 0.8, cy);
  ctx.closePath();
  ctx.fill();
}

function triLeft(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.6, cy - r);
  ctx.lineTo(cx + r * 0.6, cy + r);
  ctx.lineTo(cx - r * 0.8, cy);
  ctx.closePath();
  ctx.fill();
}

function bar(ctx, cx, cy, r) {
  ctx.fillRect(cx - r * 0.15, cy - r, r * 0.3, r * 2);
}

// A stroked arc with a small triangular arrowhead at its end angle (degrees).
function arcWithArrow(ctx, cx, cy, r, startDeg, endDeg) {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();

  const tipX = cx + r * Math.cos(end);
  const tipY = cy + r * Math.sin(end);
  const tangent = end + Math.PI / 2;
  const headLen = r * 0.45;
  const spread = 0.5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headLen * Math.cos(tangent - spread),
    tipY - headLen * Math.sin(tangent - spread),
  );
  ctx.lineTo(
    tipX - headLen * Math.cos(tangent + spread),
    tipY - headLen * Math.sin(tangent + spread),
  );
  ctx.closePath();
  ctx.fill();
}

function speaker(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.9, cy - r * 0.3);
  ctx.lineTo(cx - r * 0.35, cy - r * 0.3);
  ctx.lineTo(cx + r * 0.2, cy - r * 0.75);
  ctx.lineTo(cx + r * 0.2, cy + r * 0.75);
  ctx.lineTo(cx - r * 0.35, cy + r * 0.3);
  ctx.lineTo(cx - r * 0.9, cy + r * 0.3);
  ctx.closePath();
  ctx.fill();
}

function soundArc(ctx, cx, cy, radius, lineWidth) {
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 3.2, Math.PI / 3.2);
  ctx.stroke();
}

export function drawGlyph(ctx, glyphName, foreground) {
  ctx.fillStyle = foreground;
  ctx.strokeStyle = foreground;

  switch (glyphName) {
    case "play":
      triRight(ctx, CENTER, CENTER, R);
      break;

    case "stop":
      ctx.fillRect(CENTER - R * 0.7, CENTER - R * 0.7, R * 1.4, R * 1.4);
      break;

    case "record":
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "rewind":
      triLeft(ctx, CENTER - R * 0.55, CENTER, R * 0.7);
      triLeft(ctx, CENTER + R * 0.55, CENTER, R * 0.7);
      break;

    case "forward":
      triRight(ctx, CENTER - R * 0.55, CENTER, R * 0.7);
      triRight(ctx, CENTER + R * 0.55, CENTER, R * 0.7);
      break;

    case "toStart":
      bar(ctx, CENTER - R * 0.7, CENTER, R * 0.75);
      triLeft(ctx, CENTER + R * 0.15, CENTER, R * 0.75);
      break;

    case "skipNext":
      triRight(ctx, CENTER - R * 0.15, CENTER, R * 0.75);
      bar(ctx, CENTER + R * 0.7, CENTER, R * 0.75);
      break;

    case "cycle":
      arcWithArrow(ctx, CENTER, CENTER, R * 0.85, -80, 260);
      break;

    case "restart":
      arcWithArrow(ctx, CENTER, CENTER, R * 0.85, 40, 320);
      break;

    case "undo":
      arcWithArrow(ctx, CENTER, CENTER, R * 0.85, 200, 20);
      break;

    case "save":
      ctx.lineWidth = R * 0.14;
      ctx.strokeRect(CENTER - R, CENTER - R, R * 2, R * 2);
      ctx.fillRect(CENTER - R * 0.5, CENTER - R, R, R * 0.6); // shutter
      ctx.strokeRect(CENTER - R * 0.55, CENTER + R * 0.1, R * 1.1, R * 0.7); // label
      break;

    case "metronome": {
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER - R);
      ctx.lineTo(CENTER + R * 0.7, CENTER + R);
      ctx.lineTo(CENTER - R * 0.7, CENTER + R);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CENTER, CENTER - R * 0.15, R * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = contrastColor(foreground);
      ctx.fill();
      break;
    }

    case "tapTempo":
      ctx.lineWidth = R * 0.16;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, R * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case "stream":
      ctx.beginPath();
      ctx.arc(CENTER - R * 0.5, CENTER + R * 0.5, R * 0.18, 0, Math.PI * 2);
      ctx.fill();
      soundArc(ctx, CENTER - R * 0.5, CENTER + R * 0.5, R * 0.55, R * 0.16);
      soundArc(ctx, CENTER - R * 0.5, CENTER + R * 0.5, R * 0.95, R * 0.16);
      break;

    case "scene":
      ctx.lineWidth = R * 0.16;
      ctx.strokeRect(CENTER - R, CENTER - R * 0.75, R * 2, R * 1.5);
      ctx.beginPath();
      ctx.moveTo(CENTER - R, CENTER - R * 0.75);
      ctx.lineTo(CENTER - R * 0.4, CENTER + R * 0.75);
      ctx.stroke();
      break;

    case "volumeUp":
      speaker(ctx, CENTER - R * 0.15, CENTER, R);
      soundArc(ctx, CENTER - R * 0.15, CENTER, R * 1.15, R * 0.16);
      break;

    case "volumeDown":
      speaker(ctx, CENTER, CENTER, R);
      break;

    case "mute":
      speaker(ctx, CENTER - R * 0.25, CENTER, R * 0.85);
      ctx.lineWidth = R * 0.2;
      ctx.beginPath();
      ctx.moveTo(CENTER - R * 0.1, CENTER - R * 0.9);
      ctx.lineTo(CENTER + R * 0.9, CENTER + R * 0.9);
      ctx.stroke();
      break;

    case "pointer":
      ctx.beginPath();
      ctx.moveTo(CENTER - R * 0.7, CENTER - R);
      ctx.lineTo(CENTER - R * 0.7, CENTER + R * 0.9);
      ctx.lineTo(CENTER - R * 0.1, CENTER + R * 0.35);
      ctx.lineTo(CENTER + R * 0.25, CENTER + R * 0.95);
      ctx.lineTo(CENTER + R * 0.5, CENTER + R * 0.75);
      ctx.lineTo(CENTER + R * 0.15, CENTER + R * 0.15);
      ctx.lineTo(CENTER + R * 0.75, CENTER + R * 0.05);
      ctx.closePath();
      ctx.fill();
      break;

    case "pencil":
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-R * 0.18, -R, R * 0.36, R * 1.6);
      ctx.beginPath();
      ctx.moveTo(-R * 0.18, R * 0.6);
      ctx.lineTo(R * 0.18, R * 0.6);
      ctx.lineTo(0, R);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;

    case "eraser":
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(-Math.PI / 6);
      ctx.beginPath();
      ctx.roundRect(-R * 0.9, -R * 0.5, R * 1.8, R, R * 0.2);
      ctx.fill();
      ctx.restore();
      break;

    case "scissors":
      ctx.lineWidth = R * 0.18;
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(
          CENTER - R * 0.55,
          CENTER + sign * R * 0.55,
          R * 0.25,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(CENTER - R * 0.4, CENTER + sign * R * 0.45);
        ctx.lineTo(CENTER + R * 0.85, CENTER - sign * R * 0.75);
        ctx.stroke();
      }
      break;

    case "marquee":
      ctx.lineWidth = R * 0.14;
      ctx.setLineDash([R * 0.3, R * 0.25]);
      ctx.strokeRect(CENTER - R, CENTER - R * 0.75, R * 2, R * 1.5);
      ctx.setLineDash([]);
      break;

    case "markIn":
      ctx.lineWidth = R * 0.22;
      ctx.beginPath();
      ctx.moveTo(CENTER + R * 0.4, CENTER - R);
      ctx.lineTo(CENTER - R * 0.4, CENTER - R);
      ctx.lineTo(CENTER - R * 0.4, CENTER + R);
      ctx.lineTo(CENTER + R * 0.4, CENTER + R);
      ctx.stroke();
      break;

    case "markOut":
      ctx.lineWidth = R * 0.22;
      ctx.beginPath();
      ctx.moveTo(CENTER - R * 0.4, CENTER - R);
      ctx.lineTo(CENTER + R * 0.4, CENTER - R);
      ctx.lineTo(CENTER + R * 0.4, CENTER + R);
      ctx.lineTo(CENTER - R * 0.4, CENTER + R);
      ctx.stroke();
      break;

    case "split":
      ctx.lineWidth = R * 0.16;
      ctx.setLineDash([R * 0.25, R * 0.2]);
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER - R);
      ctx.lineTo(CENTER, CENTER + R);
      ctx.stroke();
      ctx.setLineDash([]);
      triLeft(ctx, CENTER - R * 0.55, CENTER, R * 0.4);
      triRight(ctx, CENTER + R * 0.55, CENTER, R * 0.4);
      break;

    case "appLauncher":
      ctx.lineWidth = R * 0.14;
      ctx.beginPath();
      ctx.roundRect(CENTER - R, CENTER - R, R * 2, R * 2, R * 0.3);
      ctx.stroke();
      for (const dx of [-0.4, 0.4]) {
        for (const dy of [-0.4, 0.4]) {
          ctx.beginPath();
          ctx.arc(CENTER + dx * R, CENTER + dy * R, R * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    default:
      // Unknown glyph name - draw nothing rather than guess; the slot keeps
      // its plain color fill (same graceful fallback as a missing icon
      // file on the firmware side).
      break;
  }
}

// Renders `glyphName` over `backgroundColor` and runs it through the same
// pipeline a user-uploaded image goes through - returns the same
// { id, bytes, previewCanvas } shape as icon.js's convertImageToIcon.
export async function generateGlyphIcon(glyphName, backgroundColor) {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_WIDTH;
  canvas.height = ICON_HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, ICON_WIDTH, ICON_HEIGHT);
  drawGlyph(ctx, glyphName, contrastColor(backgroundColor));

  const imageData = ctx.getImageData(0, 0, ICON_WIDTH, ICON_HEIGHT);
  const bytes = rgbaToRgb565(imageData.data, ICON_WIDTH, ICON_HEIGHT);
  const id = await computeIconId(bytes);
  return { id, bytes, previewCanvas: canvas };
}
