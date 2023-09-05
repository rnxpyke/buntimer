function updateDate(date, time) {
    const [hours, minutes] = time.split(":");
    const res = new Date(date);
    res.setHours(hours, minutes);
    return res;
}

function timeupdateConfig(event) {
    const params = event.detail.requestConfig.parameters;
    params.startDate = updateDate(params.startDate, params.start).toISOString();
    params.stopDate = updateDate(params.stopDate, params.stop).toISOString();
    params.timezoneOffset = startDate.getTimezoneOffset();
    console.log(params);
}