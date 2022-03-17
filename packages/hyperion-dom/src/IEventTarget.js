/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 */
import { DOMShadowPrototype, sampleHTMLElement } from "./DOMShadowPrototype";
import { FunctionInterceptor } from "@hyperion/hyperion-core/src/FunctionInterceptor";
export const IEventTargetPrototype = new DOMShadowPrototype(EventTarget, null, { sampleObject: sampleHTMLElement });
export const addEventListener = new FunctionInterceptor('addEventListener', IEventTargetPrototype);
export const dispatchEvent = new FunctionInterceptor('dispatchEvent', IEventTargetPrototype);
export const removeEventListener = new FunctionInterceptor('removeEventListener', IEventTargetPrototype);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSUV2ZW50VGFyZ2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiSUV2ZW50VGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBRUgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDN0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0saURBQWlELENBQUE7QUFFckYsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztBQUVwSCxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLG1CQUFtQixDQUFDLGtCQUFrQixFQUFFLHFCQUFxQixDQUFDLENBQUM7QUFDbkcsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLElBQUksbUJBQW1CLENBQUMsZUFBZSxFQUFFLHFCQUFxQixDQUFDLENBQUM7QUFDN0YsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxxQkFBcUIsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDIn0=