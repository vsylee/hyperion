/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */

import type { InterceptedModuleExports, ModuleExportsKeys } from './IRequire';

import { interceptModuleExports } from './IRequire';

import React from "react";
import { Class } from './FlowToTsTypes';

export type ReactComponentObjectProps = {
  [keys: string]: any,
};

//#region TS types for React
export type ReactNode = React.ReactNode;
export type ReactStatelessFunctionalComponent<T> = React.NamedExoticComponent<T>
type ReactElement<P> = React.ReactElement<P>;
//#endregion

//#region Flow types for React
// export type ReactNode = React.ReactNode;
// type ReactStatelessFunctionalComponent<T> = React.NamedExoticComponent<T>
// type ReactElement<P> = React.ReactElement<P>;
// type ReactStatelessFunctionalComponent<T> = React.NamedExoticComponent<T>
// type ReactElement<P> = React$MixedElement<P>;
//#endregion


export type ReactComponentStatics = Readonly<{
  // The rest of the component types usually have at least one of these members
  name?: string,
  displayName?: string,
}>;

export type ReactSpecialComponent = ReactComponentStatics & {
  $$typeof: symbol,
};

export type ReactForwardRefType<Props = ReactComponentObjectProps> = ReactSpecialComponent & {
  render: (props: Props) => ReactNode,
};

export type ReactMemoType<Props = ReactComponentObjectProps> = ReactSpecialComponent & {
  type: ReactForwardRefType<Props>,
};

export type ReactSpecialComponentTypes<Props = ReactComponentObjectProps> =
  | ReactForwardRefType<Props>
  | ReactMemoType<Props>
  | ReactSpecialComponent;


export type ReactElementComponentType<Props> =
  | ReactStatelessFunctionalComponent<Props>
  // | Class<React.AbstractComponent<Props>>
  | Class<React.Component<Props>>
  | ((props: Props) => ReactElement<Props>);

export type ReactComponentType<Props = ReactComponentObjectProps> =
  | string
  | React.JSXElementConstructor<Props>
  | ReactElementComponentType<Props>

type JSXType<Props = ReactComponentObjectProps> = (
  type: ReactComponentType<Props>,
  props: Props,
  children: React.ReactNode,
) => React.ReactElement<Props>;

type JsxRuntimeModuleExports = {
  /**
   * Used in production
   */
  jsx: JSXType,
  jsxs: JSXType,

  /**
   * Used in dev
   */
  jsxDEV: JSXType,
}

type ReactModuleExports = {
  createElement: (typeof React)['createElement'];
}

export type IJsxRuntimeModuleExports = InterceptedModuleExports<JsxRuntimeModuleExports>;
export type IReactModuleExports = InterceptedModuleExports<ReactModuleExports>;
let IJsxRuntimeModule: IJsxRuntimeModuleExports | null = null;
let IReactModule: IReactModuleExports | null = null;

export function interceptRuntime(moduleExports: JsxRuntimeModuleExports, failedExportsKeys?: ModuleExportsKeys<typeof moduleExports>): IJsxRuntimeModuleExports {
  if (!IJsxRuntimeModule) {
    IJsxRuntimeModule = interceptModuleExports("react", moduleExports, ['jsx', 'jsxs', 'jsxDEV'], failedExportsKeys);

    /**
     * https://github.com/facebook/react/blob/cae635054e17a6f107a39d328649137b83f25972/packages/react/src/jsx/ReactJSX.js#L19
     * The '.jsxs' is a special function that in development it points to a unique
     * function, but in production, it points to '.jsx'.
     * Hyperion does not reintercept the same function intentionally to ensure
     * developer is aware of how the hooks are intalled on the function.
     */
    if (IJsxRuntimeModule.jsxs && moduleExports.jsxs !== IJsxRuntimeModule.jsxs.interceptor) {
      moduleExports.jsxs = IJsxRuntimeModule.jsxs.interceptor;
    }

  }
  return IJsxRuntimeModule;
}

export function intercept(moduleExports: ReactModuleExports, failedExportsKeys?: ModuleExportsKeys<ReactModuleExports>): IReactModuleExports {
  if (!IReactModule) {
    IReactModule = interceptModuleExports("react", moduleExports, ['createElement'], failedExportsKeys);
  }
  return IReactModule;
}