import { Fragment, createElement } from '@kitajs/html';

export { 
  Fragment,
  createElement
}

function jsx(type: any, props: any, hm1:any, bool:any, hm2:any, that: any) {
  return createElement(type, props, props?.children);
}

export {
  jsx,
  jsx as jsxDEV,
}