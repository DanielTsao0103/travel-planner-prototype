/**
 * Pre-computed walking routes for the sample trip's two key demo moments
 * (Day 2, 2:20 PM, just outside Time Out Market):
 *   - to Padaria Celeste (the Page 16 nearby match)
 *   - to Santa Justa Lift (Page 10's "Where to next")
 * Generated once from the FOSSGIS Valhalla pedestrian router (OpenStreetMap data)
 * so the demo is consistent and works even if the live routing services are down.
 */

export interface BundledRoute {
  /** Start (the simulated "you") and destination, [lat, lng]. */
  from: [number, number];
  to: [number, number];
  distanceM: number;
  minutes: number;
  coords: Array<[number, number]>;
  steps: Array<{ instruction: string; distanceM: number }>;
}

export const BUNDLED_ROUTES: Record<string, BundledRoute> = {
  "padaria-celeste": {
    "from": [
      38.706926,
      -9.145693
    ],
    "to": [
      38.7074,
      -9.1472
    ],
    "distanceM": 198,
    "minutes": 3,
    "coords": [
      [
        38.70663,
        -9.145701
      ],
      [
        38.706639,
        -9.146211
      ],
      [
        38.706658,
        -9.14626
      ],
      [
        38.706658,
        -9.146294
      ],
      [
        38.706658,
        -9.146317
      ],
      [
        38.706658,
        -9.146342
      ],
      [
        38.706658,
        -9.146377
      ],
      [
        38.706742,
        -9.146483
      ],
      [
        38.706918,
        -9.146626
      ],
      [
        38.706987,
        -9.146624
      ],
      [
        38.707069,
        -9.146622
      ],
      [
        38.70717,
        -9.14662
      ],
      [
        38.707173,
        -9.146835
      ],
      [
        38.707243,
        -9.146833
      ],
      [
        38.707405,
        -9.146984
      ],
      [
        38.707472,
        -9.147052
      ],
      [
        38.707473,
        -9.147101
      ],
      [
        38.707473,
        -9.147141
      ],
      [
        38.707399,
        -9.147143
      ]
    ],
    "steps": [
      {
        "instruction": "Walk west on the walkway.",
        "distanceM": 58
      },
      {
        "instruction": "Bear right onto the walkway.",
        "distanceM": 64
      },
      {
        "instruction": "Turn left onto the walkway.",
        "distanceM": 19
      },
      {
        "instruction": "Turn right onto the walkway.",
        "distanceM": 48
      },
      {
        "instruction": "Turn left onto Praça Dom Luís I.",
        "distanceM": 8
      },
      {
        "instruction": "You have arrived at your destination.",
        "distanceM": 0
      }
    ]
  },
  "santa-justa": {
    "from": [
      38.706926,
      -9.145693
    ],
    "to": [
      38.7121,
      -9.1394
    ],
    "distanceM": 1201,
    "minutes": 16,
    "coords": [
      [
        38.70663,
        -9.145701
      ],
      [
        38.706623,
        -9.145271
      ],
      [
        38.706637,
        -9.14517
      ],
      [
        38.70663,
        -9.144889
      ],
      [
        38.706629,
        -9.144872
      ],
      [
        38.706629,
        -9.144836
      ],
      [
        38.70662,
        -9.144482
      ],
      [
        38.706619,
        -9.144457
      ],
      [
        38.706677,
        -9.144419
      ],
      [
        38.706976,
        -9.144263
      ],
      [
        38.707331,
        -9.144088
      ],
      [
        38.707131,
        -9.143516
      ],
      [
        38.70713,
        -9.143504
      ],
      [
        38.707118,
        -9.143412
      ],
      [
        38.707116,
        -9.1434
      ],
      [
        38.707238,
        -9.142869
      ],
      [
        38.707247,
        -9.142846
      ],
      [
        38.707391,
        -9.142273
      ],
      [
        38.707395,
        -9.142256
      ],
      [
        38.707413,
        -9.142177
      ],
      [
        38.707433,
        -9.142089
      ],
      [
        38.707473,
        -9.141927
      ],
      [
        38.707481,
        -9.141892
      ],
      [
        38.707514,
        -9.141833
      ],
      [
        38.707576,
        -9.141589
      ],
      [
        38.707576,
        -9.141572
      ],
      [
        38.707531,
        -9.141294
      ],
      [
        38.707532,
        -9.14127
      ],
      [
        38.70754,
        -9.141248
      ],
      [
        38.707553,
        -9.141231
      ],
      [
        38.70757,
        -9.141221
      ],
      [
        38.707588,
        -9.14122
      ],
      [
        38.707839,
        -9.141237
      ],
      [
        38.707926,
        -9.141243
      ],
      [
        38.707991,
        -9.141256
      ],
      [
        38.708006,
        -9.141258
      ],
      [
        38.708003,
        -9.141174
      ],
      [
        38.707999,
        -9.141104
      ],
      [
        38.707994,
        -9.14104
      ],
      [
        38.707992,
        -9.140981
      ],
      [
        38.707993,
        -9.140915
      ],
      [
        38.707997,
        -9.140816
      ],
      [
        38.708006,
        -9.140586
      ],
      [
        38.70801,
        -9.140456
      ],
      [
        38.708009,
        -9.140394
      ],
      [
        38.708007,
        -9.140326
      ],
      [
        38.708005,
        -9.140267
      ],
      [
        38.708001,
        -9.140204
      ],
      [
        38.707997,
        -9.140158
      ],
      [
        38.707995,
        -9.140122
      ],
      [
        38.707995,
        -9.140095
      ],
      [
        38.707997,
        -9.140074
      ],
      [
        38.708,
        -9.140056
      ],
      [
        38.708015,
        -9.140022
      ],
      [
        38.708033,
        -9.139996
      ],
      [
        38.708052,
        -9.139976
      ],
      [
        38.708062,
        -9.139967
      ],
      [
        38.708093,
        -9.139954
      ],
      [
        38.708185,
        -9.139923
      ],
      [
        38.708201,
        -9.139917
      ],
      [
        38.708214,
        -9.139909
      ],
      [
        38.708227,
        -9.139898
      ],
      [
        38.70826,
        -9.139857
      ],
      [
        38.708288,
        -9.139831
      ],
      [
        38.70832,
        -9.139813
      ],
      [
        38.708414,
        -9.139782
      ],
      [
        38.708431,
        -9.139774
      ],
      [
        38.708504,
        -9.139744
      ],
      [
        38.708592,
        -9.139699
      ],
      [
        38.708677,
        -9.139646
      ],
      [
        38.70876,
        -9.139587
      ],
      [
        38.708839,
        -9.13952
      ],
      [
        38.708898,
        -9.139467
      ],
      [
        38.708952,
        -9.139409
      ],
      [
        38.709002,
        -9.139345
      ],
      [
        38.709048,
        -9.139275
      ],
      [
        38.709089,
        -9.139201
      ],
      [
        38.709126,
        -9.139123
      ],
      [
        38.709157,
        -9.139042
      ],
      [
        38.709183,
        -9.138956
      ],
      [
        38.709197,
        -9.138895
      ],
      [
        38.709212,
        -9.138828
      ],
      [
        38.709298,
        -9.138473
      ],
      [
        38.709381,
        -9.138132
      ],
      [
        38.709394,
        -9.138137
      ],
      [
        38.709406,
        -9.138142
      ],
      [
        38.709413,
        -9.138145
      ],
      [
        38.709416,
        -9.138131
      ],
      [
        38.70943,
        -9.138127
      ],
      [
        38.709448,
        -9.138134
      ],
      [
        38.71008,
        -9.138381
      ],
      [
        38.710774,
        -9.138652
      ],
      [
        38.711448,
        -9.138914
      ],
      [
        38.71147,
        -9.138923
      ],
      [
        38.711492,
        -9.138932
      ],
      [
        38.712162,
        -9.139193
      ],
      [
        38.712151,
        -9.139223
      ],
      [
        38.712154,
        -9.139224
      ],
      [
        38.712173,
        -9.139231
      ],
      [
        38.712158,
        -9.139294
      ],
      [
        38.712148,
        -9.139336
      ],
      [
        38.712142,
        -9.139365
      ],
      [
        38.712133,
        -9.139404
      ]
    ],
    "steps": [
      {
        "instruction": "Walk east on the walkway.",
        "distanceM": 107
      },
      {
        "instruction": "Turn left onto Travessa dos Remolares.",
        "distanceM": 85
      },
      {
        "instruction": "Turn right onto Rua Nova do Carvalho.",
        "distanceM": 114
      },
      {
        "instruction": "Continue on Rua do Corpo Santo.",
        "distanceM": 87
      },
      {
        "instruction": "Bear left onto Calçada do Ferragial.",
        "distanceM": 63
      },
      {
        "instruction": "Turn left to stay on Calçada do Ferragial.",
        "distanceM": 49
      },
      {
        "instruction": "Turn right onto Rua Vítor Cordon.",
        "distanceM": 103
      },
      {
        "instruction": "Bear left onto Calçada de São Francisco.",
        "distanceM": 246
      },
      {
        "instruction": "Turn left onto the walkway.",
        "distanceM": 4
      },
      {
        "instruction": "Turn right onto the walkway.",
        "distanceM": 321
      },
      {
        "instruction": "Turn left onto Rua de Santa Justa.",
        "distanceM": 3
      },
      {
        "instruction": "Bear right onto the walkway.",
        "distanceM": 17
      },
      {
        "instruction": "You have arrived at your destination.",
        "distanceM": 0
      }
    ]
  }
};
