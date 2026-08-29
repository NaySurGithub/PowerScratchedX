import * as Blockly from 'blockly';

export const theme = Blockly.Theme.defineTheme('powerscratchedx', {
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: '#eef1f7',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#2b2f3a',
    flyoutBackgroundColour: '#f6f8fc',
    flyoutForegroundColour: '#2b2f3a',
    flyoutOpacity: 0.98,
    scrollbarColour: '#c7cdd9',
    scrollbarOpacity: 0.8,
    insertionMarkerColour: '#4c97ff',
    insertionMarkerOpacity: 0.3,
    markerColour: '#4c97ff',
    cursorColour: '#4c97ff',
  },
  fontStyle: {
    family: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    weight: '600',
    size: 12,
  },
  startHats: true,
});
