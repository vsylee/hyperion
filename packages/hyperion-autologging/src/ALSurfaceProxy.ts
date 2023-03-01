/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */

'use strict';


import type * as React from 'react';
import { useALSurfaceContext } from './ALSurfaceContext';
import * as IReactDOM from "@hyperion/hyperion-react/src/IReactDOM";
import { SurfacePropsExtension } from './ALSurfacePropsExtension';
import { SurfaceComponent } from './ALSurface';
import { ALFlowletManager } from './ALFlowletManager';
import * as Types from "@hyperion/hyperion-util/src/Types";


export type InitOptions = Types.Options<{
  ReactModule: { createElement: typeof React.createElement, Fragment: typeof React.Fragment };
  IReactDOMModule: IReactDOM.IReactDOMModuleExports;
  flowletManager: ALFlowletManager;
}>;

type ProxyInitOptions =
  InitOptions &
  // Additional options that will be passed from within ALSurface
  Readonly<{
    surfaceComponent: SurfaceComponent;
  }>;

/**
 * We need to use a hook to get the surface value, but the rules of using
 * hooks won't allow us to call it outside of a react component.
 * So, the following proxy component is purely for getting around this
 * limitation and reading the current surface value during rendering.
 * If we can find a way around this limitation, we can use a simpler logic
 * like the following:
 */
function SurfaceProxy(props: React.PropsWithChildren<ProxyInitOptions>): React.ReactElement {
  const { ReactModule, surfaceComponent, flowletManager, children } = props;
  const { surface, flowlet } = useALSurfaceContext();
  if (surface != null && flowlet != null) {
    return ReactModule.createElement(
      surfaceComponent,
      {
        __ext: new SurfacePropsExtension(flowlet),
        flowlet: flowlet,
        flowletManager: flowletManager,
        fullSurfaceString: surface,
      },
      children
    );
  } else {
    return ReactModule.createElement(ReactModule.Fragment, {}, children);
  }
}

export function init(options: ProxyInitOptions): void {
  const { IReactDOMModule, ReactModule } = options;
  /**
   * When createPortal is called, the react components will be added to a
   * separate container DOM node and shown in place later.
   * Although DOM tree hierarchy is broken, the React Context hierarchy will
   * continue to work. So, we use that fact and wrap the node in another Surface
   * with the same flowlet and surface from the original surface context.
   */
  IReactDOMModule.createPortal.onArgsMapperAdd(args => {
    const [node, _container] = args;

    if (node != null) {
      args[0] = ReactModule.createElement(SurfaceProxy, options, node);
    }
    return args;
  });

}