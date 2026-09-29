declare module Meteor {
    let _isFibersEnabled: boolean

    function _getAslStore(): Record<string, any>

    function _runAsync(func: Function, ctx: object, store: Record<string, any>): void

    function _getValueFromAslStore(key: string): any

    function _updateAslStore(key: string, value: any): void
}
