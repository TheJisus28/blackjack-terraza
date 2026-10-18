"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";

/**
 * Renders the scene at a fraction of the screen resolution with nearest
 * upscaling and depth/normal edge outlines: the "3D pixel art" look.
 */
export function PixelPipeline({ pixelSize }: { pixelSize: number }) {
  const { gl, scene, camera, size } = useThree();

  const { composer, pass } = useMemo(() => {
    const composer = new EffectComposer(gl);
    const pass = new RenderPixelatedPass(3, scene, camera, { normalEdgeStrength: 0.22, depthEdgeStrength: 0.38 });
    composer.addPass(pass);
    composer.addPass(new OutputPass());
    return { composer, pass };
  }, [gl, scene, camera]);

  useEffect(() => {
    pass.setPixelSize(pixelSize);
  }, [pass, pixelSize]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => composer.render(), 1);
  return null;
}
