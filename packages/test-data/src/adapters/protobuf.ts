import type { Type, Message } from 'protobufjs';
import type { Shape } from '../core/shape.js';
import { createMessageReader } from './protobuf/messages.js';

export function fromProtobuf<T extends object = Message>(type: Type): Shape<T> {
  type.resolveAll();
  return createMessageReader()(type) as Shape<T>;
}
