const text = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const player = () => ({ shadow: { type: 'player_current' } });

export const starterProject = {
  format: 'powerscratchedx',
  formatVersion: 1,
  meta: {
    name: 'MyPlugin',
    version: '1.0.0',
    author: '',
    description: 'Made with PowerScratchedX',
  },
  workspace: {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'evt_enable',
          x: 40,
          y: 40,
          inputs: {
            DO: {
              block: {
                type: 'server_log',
                inputs: { TEXT: text('MyPlugin enabled!') },
              },
            },
          },
        },
        {
          type: 'evt_player_join',
          x: 40,
          y: 220,
          inputs: {
            DO: {
              block: {
                type: 'player_send_message',
                inputs: {
                  PLAYER: player(),
                  TEXT: {
                    shadow: { type: 'text', fields: { TEXT: '' } },
                    block: {
                      type: 'text_join',
                      extraState: { itemCount: 3 },
                      inputs: {
                        ADD0: { block: { type: 'op_color', fields: { CODE: '§a' } } },
                        ADD1: text('Welcome '),
                        ADD2: { block: { type: 'player_name', inputs: { PLAYER: player() } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          type: 'cmd_hat',
          x: 520,
          y: 40,
          fields: { NAME: 'hello', DESC: 'Say hello', PERM: '' },
          inputs: {
            DO: {
              block: {
                type: 'cmd_reply',
                inputs: { TEXT: text('Hello from PowerScratchedX!') },
                next: {
                  block: {
                    type: 'player_play_sound',
                    inputs: { PLAYER: player(), SOUND: text('random.levelup') },
                  },
                },
              },
            },
          },
        },
        {
          type: 'time_every',
          x: 520,
          y: 300,
          fields: { TICKS: 1200 },
          inputs: {
            DO: {
              block: {
                type: 'server_broadcast',
                inputs: { TEXT: text('§eThis server runs a PowerScratchedX plugin!') },
              },
            },
          },
        },
        {
          type: 'cfg_default',
          x: 40,
          y: 460,
          fields: { KEY: 'welcome' },
          inputs: { VALUE: num(1) },
        },
      ],
    },
  },
};
