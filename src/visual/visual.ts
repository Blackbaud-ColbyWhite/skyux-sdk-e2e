import {
  SkyVisualCompareScreenshotConfig,
  SkyVisualCompareScreenshotResult
} from './types';

// Apply jasmine matchers as a side effect when this file is imported into a spec.
import './matchers';

const logger = require('@blackbaud/skyux-logger');
const PixDiff = require('pix-diff');
const protractor = require('protractor');

let nextUniqueId = 0;

export abstract class SkyVisual {
  public static compareScreenshot(
    config: SkyVisualCompareScreenshotConfig
  ): Promise<SkyVisualCompareScreenshotResult> {
    if (!protractor.browser.pixDiff) {
      protractor.browser.pixDiff = SkyVisual.createComparator();
    }

    const defaults: SkyVisualCompareScreenshotConfig = {
      selector: 'body'
    };

    const settings = Object.assign({}, defaults, config);
    const subject = protractor.element(protractor.by.css(settings.selector));
    const thresholdPercent = 0.02;

    if (!settings.screenshotName) {
      settings.screenshotName = settings.selector
        .replace(/\W+(?!$)/g, '-')
        .replace(/\W+$/, '')
        .toLowerCase() + nextUniqueId++;
    }

    return protractor.browser.pixDiff
      .checkRegion(
        subject,
        settings.screenshotName,
        {
          threshold: thresholdPercent,
          thresholdType: PixDiff.THRESHOLD_PERCENT
        }
      )
      .then((results: any) => {
        const isSimilar = (
          results.code === PixDiff.RESULT_SIMILAR ||
          results.code === PixDiff.RESULT_IDENTICAL
        );

        if (!isSimilar) {
          const mismatchPercentage = (results.differences / results.dimension * 100).toFixed(2);
          const message = 'Expected screenshots to match.\n' +
            `Screenshots have mismatch of ${mismatchPercentage} percent!`;
          throw new Error(message);
        }
      })
      .catch((error: any) => {
        // Ignore 'baseline image not found' errors from PixDiff.
        if (error.message.indexOf('saving current image') > -1) {
          const message = `[${settings.screenshotName}] ${error.message}`;

          // Wait for a tick so that the log is printed beneath the
          // spec's heading in the console.
          setTimeout(() => {
            logger.info(message);
          });

          return;
        }

        throw error;
      });
  }

  private static createComparator(): any {
    const defaults = {
      basePath: 'screenshots-baseline-local',
      baseline: true,
      createdPath: 'screenshots-created-local',
      createdPathDiff: 'screenshots-created-diff-local',
      diffPath: 'screenshots-diff-local',
      height: 800,
      width: 1000
    };

    const config = Object.assign(
      {},
      defaults,
      protractor.browser.skyVisualConfig &&
      protractor.browser.skyVisualConfig.compareScreenshot
    );

    return new PixDiff(config);
  }
}