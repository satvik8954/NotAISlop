import type { Detection, DetectionStats, ScanResult } from './types';

export const MOCK_DETECTIONS: Detection[] = [
  {
    "detection_id": "Corsair_01.png_0",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.99,
    "raw_confidence": 0.9927101288327931,
    "shadow_multiplier": 1.0,
    "bbox_px": [1056, 288, 1312, 544],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505116Z"
  },
  {
    "detection_id": "Corsair_01.png_1",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.99,
    "raw_confidence": 0.9916637550659951,
    "shadow_multiplier": 1.0,
    "bbox_px": [1056, 1344, 1312, 1600],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505155Z"
  },
  {
    "detection_id": "Corsair_01.png_2",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.99,
    "raw_confidence": 0.9913051004440054,
    "shadow_multiplier": 1.0,
    "bbox_px": [768, 384, 1024, 640],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505170Z"
  },
  {
    "detection_id": "Corsair_01.png_3",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.986,
    "raw_confidence": 0.9859890746169452,
    "shadow_multiplier": 1.0,
    "bbox_px": [672, 1440, 928, 1696],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505181Z"
  },
  {
    "detection_id": "Corsair_01.png_4",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.985,
    "raw_confidence": 0.9852211450851982,
    "shadow_multiplier": 1.0,
    "bbox_px": [768, 96, 1024, 352],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505192Z"
  },
  {
    "detection_id": "Corsair_01.png_8",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.948,
    "raw_confidence": 0.9770101051839915,
    "shadow_multiplier": 0.971,
    "bbox_px": [768, 1152, 1024, 1408],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505235Z"
  },
  {
    "detection_id": "Corsair_01.png_10",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.942,
    "raw_confidence": 0.9758885381930154,
    "shadow_multiplier": 0.965,
    "bbox_px": [768, 576, 1024, 832],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505257Z"
  },
  {
    "detection_id": "Corsair_01.png_16",
    "source_image": "Corsair_01.png",
    "class": "shipwreck",
    "confidence": 0.865,
    "raw_confidence": 0.8753665155538884,
    "shadow_multiplier": 0.989,
    "bbox_px": [864, 768, 1120, 1024],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:51.505323Z"
  },
  {
    "detection_id": "Monrovia_02.png_0",
    "source_image": "Monrovia_02.png",
    "class": "shipwreck",
    "confidence": 0.983,
    "raw_confidence": 0.994239299734508,
    "shadow_multiplier": 0.989,
    "bbox_px": [768, 1056, 1024, 1312],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:57.073663Z"
  },
  {
    "detection_id": "Monrovia_02.png_1",
    "source_image": "Monrovia_02.png",
    "class": "shipwreck",
    "confidence": 0.942,
    "raw_confidence": 0.9907890197837704,
    "shadow_multiplier": 0.951,
    "bbox_px": [576, 1152, 832, 1408],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:57.073676Z"
  },
  {
    "detection_id": "Monrovia_02.png_2",
    "source_image": "Monrovia_02.png",
    "class": "shipwreck",
    "confidence": 0.395,
    "raw_confidence": 0.9864268955532699,
    "shadow_multiplier": 0.4,
    "bbox_px": [768, 672, 1024, 928],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:57.073681Z"
  },
  {
    "detection_id": "Monrovia_02.png_7",
    "source_image": "Monrovia_02.png",
    "class": "shipwreck",
    "confidence": 0.99,
    "raw_confidence": 0.9796527349732773,
    "shadow_multiplier": 1.15,
    "bbox_px": [768, 480, 1024, 736],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:57.073701Z"
  },
  {
    "detection_id": "Monrovia_02.png_14",
    "source_image": "Monrovia_02.png",
    "class": "shipwreck",
    "confidence": 0.804,
    "raw_confidence": 0.9065189732354194,
    "shadow_multiplier": 0.887,
    "bbox_px": [960, 576, 1216, 832],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:57.073778Z"
  },
  {
    "detection_id": "1693569523.810.png_0",
    "source_image": "1693569523.810.png",
    "class": "pipe",
    "confidence": 0.974,
    "raw_confidence": 0.9744960178169819,
    "shadow_multiplier": 1.0,
    "bbox_px": [2016, 0, 2272, 256],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:58.925104Z"
  },
  {
    "detection_id": "1693569523.810.png_1",
    "source_image": "1693569523.810.png",
    "class": "pipe",
    "confidence": 0.965,
    "raw_confidence": 0.9651963237388609,
    "shadow_multiplier": 1.0,
    "bbox_px": [1824, 96, 2080, 352],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:58.925115Z"
  },
  {
    "detection_id": "1693569523.810.png_2",
    "source_image": "1693569523.810.png",
    "class": "pipe",
    "confidence": 0.943,
    "raw_confidence": 0.9497738440616139,
    "shadow_multiplier": 0.993,
    "bbox_px": [1536, 0, 1792, 256],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:58.925119Z"
  },
  {
    "detection_id": "1693569523.810.png_4",
    "source_image": "1693569523.810.png",
    "class": "pipe",
    "confidence": 0.833,
    "raw_confidence": 0.9365425355518733,
    "shadow_multiplier": 0.889,
    "bbox_px": [2208, 96, 2464, 352],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:58.925127Z"
  },
  {
    "detection_id": "1693569523.810.png_6",
    "source_image": "1693569523.810.png",
    "class": "pipe",
    "confidence": 0.916,
    "raw_confidence": 0.9156563200482437,
    "shadow_multiplier": 1.0,
    "bbox_px": [768, 192, 1024, 448],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:58.925144Z"
  },
  {
    "detection_id": "0003_2021.png_0",
    "source_image": "0003_2021.png",
    "class": "cylinder",
    "confidence": 0.812,
    "raw_confidence": 0.8560238247643821,
    "shadow_multiplier": 0.949,
    "bbox_px": [128, 64, 320, 192],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:59.105216Z"
  },
  {
    "detection_id": "0003_2021.png_1",
    "source_image": "0003_2021.png",
    "class": "cylinder",
    "confidence": 0.771,
    "raw_confidence": 0.8113205432219416,
    "shadow_multiplier": 0.95,
    "bbox_px": [64, 128, 256, 320],
    "geotag": "not_available_no_nav_metadata",
    "detected_at": "2026-09-13T18:47:59.105258Z"
  }
];

export const MOCK_SCAN_RESULTS: ScanResult[] = [
  {
    imageName: 'Corsair_01.png',
    imagePath: '/samples/Corsair_01.png',
    detections: MOCK_DETECTIONS.filter(d => d.source_image === 'Corsair_01.png'),
    processedAt: '2026-09-13T18:47:51Z'
  },
  {
    imageName: 'Monrovia_02.png',
    imagePath: '/samples/Monrovia_02.png',
    detections: MOCK_DETECTIONS.filter(d => d.source_image === 'Monrovia_02.png'),
    processedAt: '2026-09-13T18:47:57Z'
  },
  {
    imageName: '1693569523.810.png',
    imagePath: '/samples/pipe_sample.png',
    detections: MOCK_DETECTIONS.filter(d => d.source_image === '1693569523.810.png'),
    processedAt: '2026-09-13T18:47:58Z'
  },
  {
    imageName: '0003_2021.png',
    imagePath: '/samples/cylinder_sample.png',
    detections: MOCK_DETECTIONS.filter(d => d.source_image === '0003_2021.png'),
    processedAt: '2026-09-13T18:47:59Z'
  }
];

export function computeStats(detections: Detection[]): DetectionStats {
  const byClass: Record<string, number> = {};
  let totalConf = 0;
  let totalShadow = 0;
  let high = 0, medium = 0, low = 0;

  for (const d of detections) {
    byClass[d.class] = (byClass[d.class] || 0) + 1;
    totalConf += d.confidence;
    totalShadow += d.shadow_multiplier;
    if (d.confidence >= 0.9) high++;
    else if (d.confidence >= 0.7) medium++;
    else low++;
  }

  return {
    total: detections.length,
    byClass,
    avgConfidence: detections.length ? totalConf / detections.length : 0,
    avgShadowMultiplier: detections.length ? totalShadow / detections.length : 0,
    highConfidence: high,
    mediumConfidence: medium,
    lowConfidence: low,
  };
}

export const CLASS_COLORS: Record<string, string> = {
  shipwreck: '#00d4ff',
  pipe: '#39ff8f',
  cylinder: '#ffb800',
  ghost_net: '#ff6b9d',
};

export const CLASS_LABELS: Record<string, string> = {
  shipwreck: 'Shipwreck',
  pipe: 'Pipeline',
  cylinder: 'Cylinder',
  ghost_net: 'Ghost Net',
};
