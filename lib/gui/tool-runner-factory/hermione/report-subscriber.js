'use strict';

const clientEvents = require('../../constants/client-events');
const {RUNNING} = require('../../../constants/test-statuses');
const {getSuitePath} = require('../../../plugin-utils').getHermioneUtils();
const {prepareTestResult} = require('../utils');
const {
    saveTestImages, saveTestCurrentImage, saveBase64Screenshot
} = require('../../../reporter-helpers');

module.exports = (hermione, reportBuilder, client, reportPath) => {
    hermione.on(hermione.events.SUITE_BEGIN, (suite) => {
        if (suite.pending) {
            return;
        }

        client.emit(clientEvents.BEGIN_SUITE, {
            name: suite.title,
            suitePath: getSuitePath(suite),
            status: RUNNING
        });
    });

    hermione.on(hermione.events.TEST_BEGIN, (data) => {
        const {title: name, browserId} = data;

        client.emit(clientEvents.BEGIN_STATE, {
            name,
            suitePath: getSuitePath(data),
            browserId,
            status: RUNNING
        });
    });

    hermione.on(hermione.events.TEST_PASS, (data) => {
        reportBuilder.addSuccess(data);

        const formattedTest = reportBuilder.format(data);
        const testResult = prepareTestResult(reportBuilder.getSuites(), formattedTest.prepareTestResult());

        client.emit(clientEvents.TEST_RESULT, testResult);
    });

    hermione.on(hermione.events.TEST_FAIL, (data) => {
        const formattedResult = reportBuilder.format(data);
        const testResult = prepareTestResult(reportBuilder.getSuites(), formattedResult.prepareTestResult());
        const saveImageFn = getSaveImageFn(formattedResult);
        const {assertViewState} = formattedResult;

        const result = formattedResult.hasDiff()
            ? reportBuilder.addFail(data, {assertViewState})
            : reportBuilder.addError(data, {assertViewState});

        saveImageFn(result, reportPath)
            .then(() => client.emit(clientEvents.TEST_RESULT, testResult));
    });

    hermione.on(hermione.events.RETRY, (data) => {
        const result = reportBuilder.addRetry(data);
        const saveImageFn = getSaveImageFn(result);

        saveImageFn(result, reportPath);
    });

    hermione.on(hermione.events.RUNNER_END, () => {
        return reportBuilder.save()
            .then(() => client.emit(clientEvents.END));
    });
};

function getSaveImageFn(formattedResult) {
    if (formattedResult.hasDiff()) {
        return saveTestImages;
    }

    return formattedResult.assertViewState ? saveTestCurrentImage : saveBase64Screenshot;
}
