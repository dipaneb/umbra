import { getCurrentWindow } from "@tauri-apps/api/window";
import type { WindowGeometry } from "../stores/settings";

// Story 1.8's onUnmounted-cancel pattern doesn't apply here: these listeners
// are attached once for the app's lifetime (src/main.ts), not a component's.
export async function attachWindowGeometryListeners(
  record: (geometry: WindowGeometry) => void,
): Promise<void> {
  const appWindow = getCurrentWindow();

  // onMoved delivers an outer position, onResized an inner size (Physical*
  // throughout — see setPosition/setSize's matching expectations in main.ts's
  // restore step). Seed from the window's current state so the first event,
  // whichever kind it is, still emits a complete {x, y, width, height}.
  const position = await appWindow.outerPosition();
  const size = await appWindow.innerSize();
  const geometry: WindowGeometry = {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };

  await appWindow.onMoved(({ payload }) => {
    geometry.x = payload.x;
    geometry.y = payload.y;
    record({ ...geometry });
  });

  await appWindow.onResized(({ payload }) => {
    geometry.width = payload.width;
    geometry.height = payload.height;
    record({ ...geometry });
  });
}
