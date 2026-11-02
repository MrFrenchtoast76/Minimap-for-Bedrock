class Form { constructor() { return new Proxy(this, { get: (t, k) => (k === "show" ? async () => ({ canceled: true }) : () => t) }); } }
export class ActionFormData extends Form {}
export class ModalFormData extends Form {}
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
