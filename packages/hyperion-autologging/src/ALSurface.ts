/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */

'use strict';

import type { Channel } from "@hyperion/hook/src/Channel";
import * as IElement from "@hyperion/hyperion-dom/src/IElement";
import { Flowlet } from "@hyperion/hyperion-flowlet/src/Flowlet";
import * as IReact from "@hyperion/hyperion-react/src/IReact";
import * as IReactComponent from "@hyperion/hyperion-react/src/IReactComponent";
import * as IReactElementVisitor from '@hyperion/hyperion-react/src/IReactElementVisitor';
import * as IReactFlowlet from "@hyperion/hyperion-react/src/IReactFlowlet";
import * as IReactPropsExtension from "@hyperion/hyperion-react/src/IReactPropsExtension";
import * as Types from "@hyperion/hyperion-util/src/Types";
import type * as React from 'react';
import { ALFlowletDataType, IALFlowlet } from "./ALFlowletManager";
import { AUTO_LOGGING_NON_INTERACTIVE_SURFACE, AUTO_LOGGING_SURFACE } from './ALSurfaceConsts';
import * as ALSurfaceContext from "./ALSurfaceContext";
import type { SurfacePropsExtension } from "./ALSurfacePropsExtension";
import * as SurfaceProxy from "./ALSurfaceProxy";
import { ALFlowletEvent, ALMetadataEvent, ALSharedInitOptions } from "./ALType";
import { assert } from "@hyperion/global";


export type ALChannelSurfaceEventData = ALMetadataEvent & ALFlowletEvent & Readonly<{
  surface: string;
  element?: Element | null;
}>;

export enum ALSurfaceCapability {
  TrackInteraction = 1 << 0, // Mark all interaction events with this surface
  TrackMutation = 1 << 1, // report mount/unmount of this surface
  // TrackVisibility = 1 << 2, // track when mounted surface's visibility changes
  // TrackBoundingRect = 1 << 3, // Report the size of the bounding rect of the surface on the screen.
}

const AllSurfaceCapabilityValues = [
  ALSurfaceCapability.TrackInteraction,
  ALSurfaceCapability.TrackMutation,
];
const AllSurfaceCapabilityValuesString = AllSurfaceCapabilityValues.map(c => ALSurfaceCapability[c]).join(',');
function surfaceCapabilityToString(capability?: ALSurfaceCapability): string {
  if (!capability) {
    return AllSurfaceCapabilityValuesString;
  }

  return AllSurfaceCapabilityValues.filter(c => (capability & c) !== 0).map(c => ALSurfaceCapability[c]).join(',');
}

export type ALSurfaceProps = Readonly<{
  surface: string;
  metadata?: ALMetadataEvent['metadata'];
  capability?: ALSurfaceCapability, // a one-hot encoding what the surface can do.
  nodeRef?: React.RefObject<Element | null | undefined>,
}>;

export type ALSurfaceRenderer = (node: React.ReactNode) => React.ReactElement;
export type ALSurfaceHOC = (props: ALSurfaceProps, renderer?: ALSurfaceRenderer) => ALSurfaceRenderer;

export type ALChannelSurfaceEvent = Readonly<{
  al_surface_mount: [ALChannelSurfaceEventData];
  al_surface_unmount: [ALChannelSurfaceEventData];
}>;

type DataType = ALFlowletDataType;
type FlowletType = IALFlowlet;
type ALChannelEventType = ALChannelSurfaceEvent;
type ALChannel = Channel<ALChannelEventType>;


export type SurfaceComponent = (props:
  IReactPropsExtension.ExtendedProps<SurfacePropsExtension<DataType, FlowletType>> &
  ALSurfaceProps &
  {
    // callFlowlet: FlowletType;
    /** The optional incoming surface that we are re-wrapping via a proxy.
     * If this is provided,  then we won't emit mutations for this surface as we are
     * doubly wrapping that surface, for surface attribution purposes.
     */
    proxiedContext?: ALSurfaceContext.ALSurfaceContextFilledValue & {
      container?: Element | DocumentFragment
    }
  }
) => React.ReactElement;

export type InitOptions = Types.Options<
  ALSharedInitOptions &
  // IReactFlowlet.InitOptions<ALFlowletDataType, FlowletType, FlowletManagerType> &
  // ALIReactFlowlet.InitOptions &
  ALSurfaceContext.InitOptions &
  SurfaceProxy.InitOptions &
  {
    react: IReactComponent.InitOptions & {
      ReactModule: {
        createElement: typeof React.createElement;
        useLayoutEffect: typeof React.useLayoutEffect;
        useRef: typeof React.useRef;
      };
      IReactModule: IReact.IReactModuleExports;
      IJsxRuntimeModule: IReact.IJsxRuntimeModuleExports;
    };
    domCallFlowletAttributeName?: string;
    channel: ALChannel;
    enableReactDomPropsExtension?: boolean;
  }
>;

const SURFACE_SEPARATOR = "/";
const SURFACE_WRAPPER_ATTRIBUTE_NAME = "data-surface-wrapper";

class SurfaceDOMString<
  DataType extends ALFlowletDataType,
  FlowletType extends Flowlet<DataType>
> extends IReactFlowlet.PropsExtension<DataType, FlowletType> {
  surface: string | undefined;
  getSurface(): string | undefined {
    return this.surface;
  }

  toString(): string {
    return this.getSurface() ?? '';
  }
}

function setupDomElementSurfaceAttribute(options: InitOptions): void {
  if (!options.enableReactDomPropsExtension) {
    return;
  }

  // We should make sure the following enabled for our particular usage in this function.
  IReactComponent.init(options.react);

  const { flowletManager, domCallFlowletAttributeName } = options;
  /**
  * if flowlets are disabled, but we still want to extend the props, we use
  * the following placeholder flowlet to let the rest of the logic work.
  * This is safer than changing the whole logic since we will eventually
  * enable AM_AL_REACT_FLOWLET fully.
  */
  const UNKNOWN_CALL_FLOWLET = new flowletManager.flowletCtor('UNKNOWN');

  const allowedTags = new Set(['div', 'span', 'li', 'button']);

  IReactComponent.onReactDOMElement.add((component, props) => {
    const hasProps = props && typeof props === 'object';
    if (!hasProps) {
      return;
    }

    const callFlowlet = flowletManager.top() ?? UNKNOWN_CALL_FLOWLET;

    /**
     * This is a dom node and will directly go to dom later, i.e. all of its
     * props are directly added as attributes. So, just add necessary info
     * here in props.
     * We will set the surface attribute here, but for now it is null. Later
     * the <Surface> component will assigne value to the top DOM nodes under
     * its own tree. The null surface attributes will be filtered later.
     */
    if (allowedTags.has(component)) {
      props[AUTO_LOGGING_SURFACE] = new SurfaceDOMString(callFlowlet);
      props[AUTO_LOGGING_NON_INTERACTIVE_SURFACE] = new SurfaceDOMString(callFlowlet);

      if (__DEV__) {
        if (domCallFlowletAttributeName) {
          /**
           * The following may add a lot of attributes to the dom nodes
           * But it is a good way to debug & validate the flow of flowlet on
           * mounted dom
           */
          props[domCallFlowletAttributeName] = callFlowlet.getFullName();
        }
      }
    }
    /**
     * The DOM node will be rendered directly, so we should make sure we
     * remove the __ext object from props so it does not show up as an
     * attribute of any node in the DOM.
     * __ext might be added when props of parent is copied to child via ...props
     */
    delete props.__ext;
  });

  /**
   * If a DOM node has a surface attribute with a null value, we want to make
   * sure that is not added to the DOM tree.
   * The following code blocks the effect of `setAttribute` by returning true
   */
  IElement.setAttribute.onBeforeCallObserverAdd(function (
    this: Element,
    attrName,
    attrValue: any,
  ) {
    switch (attrName) {
      case AUTO_LOGGING_SURFACE:
      case AUTO_LOGGING_NON_INTERACTIVE_SURFACE:
        if (
          attrValue === '' ||
          attrValue === 'null' ||
          (attrValue instanceof SurfaceDOMString && attrValue.toString() === '')
        ) {
          return true;
        }
        break;
      case 'data-testids':
        /**
         * This is manage JEST innerworking and assersions. When surface wrappers are added
         * jest might mark them the same way as other elements on the page, but they are not
         * actually part of the application.
         * The following code prevents any such markings, to ensure normal application
         * assertions work correctly.
         */
        if (
          this.nodeName === 'SPAN' && (
            this.hasAttribute(SURFACE_WRAPPER_ATTRIBUTE_NAME) ||
            this.hasAttribute(AUTO_LOGGING_SURFACE)
          )
        ) {
          return true;
        }
        break;
    }
    return false;
  });
}


export function init(options: InitOptions): ALSurfaceHOC {
  const { flowletManager, channel } = options;
  const { ReactModule } = options.react;

  setupDomElementSurfaceAttribute(options);
  const SurfaceContext = ALSurfaceContext.init(options);

  type SurfaceData = ALSurfaceContext.ALSurfaceContextFilledValue & {
    domAttributeName: string;
    domAttributeValue: string;
  }

  const SurfaceDataMap = new Map<string, SurfaceData>();

  const Surface: SurfaceComponent = props => {
    const { surface, proxiedContext } = props;
    // if (__ext && __ext.flowlet !== flowlet) {
    //   __ext.flowlet = flowlet;
    // }

    let surfacePath: string;
    let nonInteractiveSurfacePath: string;
    let domAttributeName: string;
    let domAttributeValue: string;

    const surfaceCtx = ALSurfaceContext.useALSurfaceContext();
    const { surface: parentSurface, nonInteractiveSurface: parentNonInteractiveSurface } = surfaceCtx;

    let addSurfaceWrapper = props.nodeRef == null;
    let localRef = ReactModule.useRef<Element>();

    if (!proxiedContext) {
      nonInteractiveSurfacePath = (parentNonInteractiveSurface ?? '') + SURFACE_SEPARATOR + surface;
      const trackInteraction = props.capability == null || (props.capability & ALSurfaceCapability.TrackInteraction); // empty .capability field is default, means all enabled!
      if (!trackInteraction) {
        surfacePath = parentSurface ?? SURFACE_SEPARATOR;
        domAttributeName = AUTO_LOGGING_NON_INTERACTIVE_SURFACE;
        domAttributeValue = nonInteractiveSurfacePath;
      } else {
        surfacePath = (parentSurface ?? '') + SURFACE_SEPARATOR + surface;
        domAttributeName = AUTO_LOGGING_SURFACE;
        domAttributeValue = surfacePath;
      }
    } else {
      surfacePath = proxiedContext.surface;
      nonInteractiveSurfacePath = proxiedContext.nonInteractiveSurface;
      domAttributeName = AUTO_LOGGING_SURFACE
      domAttributeValue = surfacePath;
      if (proxiedContext.container instanceof Element) {
        const container = proxiedContext.container;
        if (container.childElementCount === 0 || container.getAttribute(domAttributeName) === domAttributeValue) {
          addSurfaceWrapper = false;
          container.setAttribute(domAttributeName, domAttributeValue);
          localRef.current = container;
        }
      }
    }

    let surfaceData: SurfaceData | undefined = SurfaceDataMap.get(nonInteractiveSurfacePath);
    let callFlowlet: FlowletType;
    if (!surfaceData) {
      assert(!proxiedContext, "Proxied surface should always have surface data already");

      /**
       * In case surfaces are unmounted, we want them all to have one common
       * ancestor so that we can assign triggerFlowlet to it and have them all
       * pick it up. This is specially useful to link event to unmount
       */
      callFlowlet = new flowletManager.flowletCtor(surface, surfaceCtx.callFlowlet ?? flowletManager.root);
      callFlowlet.data.surface = nonInteractiveSurfacePath;
      surfaceData = {
        surface: surfacePath,
        nonInteractiveSurface: nonInteractiveSurfacePath,
        callFlowlet,
        domAttributeName,
        domAttributeValue,
      };
      SurfaceDataMap.set(nonInteractiveSurfacePath, surfaceData);
    } else {
      callFlowlet = surfaceData.callFlowlet;
    }

    if (!proxiedContext) {
      // Emit surface mutation events on mount/unmount
      const metadata = props.metadata ?? {}; // Note that we want the same object to be shared between events to share the changes.
      metadata.original_call_flowlet = callFlowlet.getFullName();
      metadata.surface_capability = surfaceCapabilityToString(props.capability);

      /**
       * We don't know when react decides to call effect callback, so to be safe make a copy
       * of what we care about incase by the time callback is called the values have changed.
       */
      const triggerFlowlet = callFlowlet.data.triggerFlowlet;

      /**
       * either we are given a ref, or we use our local one. In anycase once
       * we have the node value, we can accurately assign the attribute, and
       * also use that for our mount/unmount event.
       */
      const nodeRef = props.nodeRef ?? localRef;

      ReactModule.useLayoutEffect(() => {
        __DEV__ && assert(nodeRef != null, "Invalid surface effect without a ref: " + surface);
        const element = nodeRef.current;
        if (element == null) {
          return;
        }
        element.setAttribute(domAttributeName, domAttributeValue);
        __DEV__ && assert(element != null, "Invalid surface effect without an element: " + surface);

        const event: ALChannelSurfaceEventData = {
          surface: domAttributeValue,
          callFlowlet,
          triggerFlowlet,
          metadata,
          element,
        };
        
        channel.emit('al_surface_mount', event);
        return () => {
          /**
           * The trigger on the surface or its parent might be updated
           * so, we should re-read that value again.
           */
          channel.emit('al_surface_unmount', {
            ...event,
            triggerFlowlet: callFlowlet.data.triggerFlowlet
          });
        }
      }, [domAttributeName, domAttributeValue, callFlowlet, triggerFlowlet, nodeRef]);
    }


    // callFlowlet.data.surface = surfacePath;
    let children = props.children;

    const wrapperElementType = proxiedContext?.container instanceof SVGElement ? "g" : "span";

    if (addSurfaceWrapper) {
      if (options.enableReactDomPropsExtension) {
        const foundDomElement = propagateFlowletDown(props.children, surfaceData);

        if (foundDomElement !== true) {
          /**
           * We could not find a dom node to safely add the attribute to it.
           *
           * We wrap the content in a dom node ourselves. Note that this will trigger
           * all the right logic and automatically add the attributes for us, and
           * this time we should succeed propagating surface/callFlowlet down.
           * This option works in almost all cases, but later we add an option to
           * the surface to prevent this option and fall back to the more expensive
           * algorithm as before (will add later)
           *
           */
          children = ReactModule.createElement(
            wrapperElementType,
            {
              [SURFACE_WRAPPER_ATTRIBUTE_NAME]: "1",
              style: { display: 'contents' },
            },
            props.children
          );
          propagateFlowletDown(children, surfaceData);
        }
      } else {
        children = ReactModule.createElement(
          wrapperElementType,
          {
            [SURFACE_WRAPPER_ATTRIBUTE_NAME]: "1",
            style: { display: 'contents' },
            [domAttributeName]: domAttributeValue,
            ref: localRef, // addSurfaceWrapper would have been false if a rep was passed in props
          },
          props.children
        );
      }
    }

    // We want to override the intercepted values
    flowletManager.push(callFlowlet);
    const result = ReactModule.createElement(
      SurfaceContext.Provider,
      {
        value: surfaceData
      },
      children
    );
    flowletManager.pop(callFlowlet);
    return result;
  }

  SurfaceProxy.init({ ...options, surfaceComponent: Surface });

  function updateFlowlet(
    ext: IReactFlowlet.PropsExtension<DataType, FlowletType> | undefined,
    params: SurfaceData,
    children: React.ReactNode,
    deep: boolean,
  ): boolean | undefined | null {
    if (!ext || !(ext instanceof IReactFlowlet.PropsExtension/* <DataType, FlowletType> */)) {
      return;
    }

    const extCallFlowlet = ext.callFlowlet;
    if (!extCallFlowlet) {
      return;
    }

    if (extCallFlowlet.data.surface !== params.callFlowlet.data.surface) {
      ext.callFlowlet = params.callFlowlet;
    }
    if (deep) {
      return propagateFlowletDown(children, params);
    }
    return;
  }


  type IDomElementExtendedProps = IReactPropsExtension.ExtendedProps<SurfacePropsExtension<DataType, FlowletType>> & {
    [index: string]: SurfaceDOMString<DataType, FlowletType>;
  }

  const propagateFlowletDown = IReactElementVisitor.createReactNodeVisitor<
    IDomElementExtendedProps,
    IReactPropsExtension.ExtendedProps<SurfacePropsExtension<DataType, FlowletType>>,
    SurfaceData,
    boolean | undefined
  >({
    domElement: (_component, props, params, _node) => {
      const ext = props[params.domAttributeName];
      if (ext instanceof SurfaceDOMString) {
        ext.surface = params.domAttributeValue;
      }
      updateFlowlet(ext, params, props.children, false);
      return true;
    },
    component: (component, props, params, _node) => {
      if (component !== Surface) {
        return updateFlowlet(props.__ext, params, props.children, true);
      }
      return;
    },
    memo: (_component, _props, params, node) => {
      let result: boolean | undefined;
      for (
        // @ts-ignore
        let fiberNode = node?._owner;
        fiberNode;
        fiberNode = fiberNode.sibling
      ) {
        const memoized = fiberNode.memoizedProps;
        const pending = fiberNode.pendingProps;
        if (memoized) {
          result =
            updateFlowlet(memoized.__ext, params, memoized.children, true) ||
            result;
        }

        if (memoized !== pending && pending) {
          result =
            updateFlowlet(pending.__ext, params, pending.children, true) ||
            result;
        }
      }
      return result;
    },
    __default: (_component, props, params, _node) => {
      return updateFlowlet(props.__ext, params, props.children, true);
    },
  });

  return (props, renderer) => {
    return children => {
      const result = ReactModule.createElement(
        Surface,
        props,
        renderer ? renderer(children) : children
      );

      return result;
    };
  };
}
