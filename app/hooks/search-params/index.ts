import { useMemo } from "react";
import {
  useLoaderData,
  useLocation,
  // eslint-disable-next-line no-restricted-imports
  useSearchParams as remixUseSearchParams,
} from "@remix-run/react";
import Cookies from "js-cookie";

import type { AssetIndexLoaderData } from "~/routes/_layout+/assets._index";
import { useAssetIndexMode } from "../use-asset-index-mode";
import { useCurrentOrganization } from "../use-current-organization-id";

/**
 * Get the types from the ReturnType of the original useSearchParams hook
 */
type SearchParamsType = ReturnType<typeof remixUseSearchParams>[0]; // URLSearchParams
type SetSearchParamsType = ReturnType<typeof remixUseSearchParams>[1];

export const useSearchParams = (): [
  SearchParamsType,
  (
    nextInit: Parameters<SetSearchParamsType>[0],
    navigateOptions?: Parameters<SetSearchParamsType>[1]
  ) => void,
] => {
  const [searchParams, setSearchParams] = remixUseSearchParams();
  const { destroyCookieValues } = useCookieDestroy();
  const isAssetIndexPage = useIsAssetIndexPage();
  const currentOrganization = useCurrentOrganization();

  /** In those cases, we return the default searchParams and setSearchParams as we dont need to handle cookies */
  if (!isAssetIndexPage || !currentOrganization) {
    return [searchParams, setSearchParams];
  }
  const customSetSearchParams: (
    nextInit: Parameters<SetSearchParamsType>[0],
    navigateOptions?: Parameters<SetSearchParamsType>[1]
  ) => void = (nextInit, navigateOptions) => {
    const prevParams = new URLSearchParams(searchParams.toString());

    const checkAndDestroyCookies = (newParams: URLSearchParams) => {
      const removedKeys: string[] = [];
      prevParams.forEach((_value, key) => {
        if (!newParams.has(key)) {
          removedKeys.push(key);
        }
      });
      if (removedKeys.length > 0) {
        destroyCookieValues(removedKeys);
      }
    };

    if (typeof nextInit === "function") {
      setSearchParams((prev) => {
        let newParams = nextInit(prev);
        // Ensure newParams is an instance of URLSearchParams
        if (!(newParams instanceof URLSearchParams)) {
          newParams = new URLSearchParams(newParams as any); // Safely cast to any to handle URLSearchParamsInit types
        }
        checkAndDestroyCookies(newParams);
        return newParams;
      }, navigateOptions);
    } else {
      let newParams = nextInit;

      // Ensure newParams is an instance of URLSearchParams
      if (!(newParams instanceof URLSearchParams)) {
        newParams = new URLSearchParams(newParams as any); // Safely cast to any to handle URLSearchParamsInit types
      }
      checkAndDestroyCookies(newParams);
      setSearchParams(newParams, navigateOptions);
    }
  };

  return [searchParams, customSetSearchParams];
};

type SetSearchParams = (
  setter: (prev: URLSearchParams) => URLSearchParams
) => void;

/**
 * Custom hook to gather and return metadata related to the asset index page.
 *
 * @returns - An object containing the filters, a boolean indicating if it's the asset index page,
 * a URLSearchParams object constructed from the filters, and the organization ID.
 */
export function useAssetIndexCookieSearchParams() {
  const assetIndexData = useLoaderData<AssetIndexLoaderData>();
  const isAssetIndexPage = useIsAssetIndexPage();

  if (!assetIndexData || !isAssetIndexPage) {
    return new URLSearchParams();
  }

  const { filters } = assetIndexData;
  const cookieSearchParams = new URLSearchParams(
    isAssetIndexPage && filters && filters !== "" ? filters : ""
  );

  return cookieSearchParams;
}

/**
 * Checks if the current page is the asset index page.
 * @returns {boolean} - True if the current page is the asset index page, otherwise false.
 */
export const useIsAssetIndexPage = (): boolean => {
  const location = useLocation();
  return location.pathname === "/assets";
};

/**
 * Returns a boolean indicating whether any of the specified keys have values
 * in the provided cookie search parameters.
 *
 * @param {string[]} keys - Array of keys (strings) to check in the cookie search parameters.
 * @param {URLSearchParams} cookieSearchParams - URLSearchParams object representing the parameters extracted from cookies.
 * @returns {boolean} - True if any of the keys exist in the cookie search parameters, otherwise false.
 */
export function checkValueInCookie(
  keys: string[],
  cookieSearchParams: URLSearchParams
): boolean {
  return keys.map((key) => cookieSearchParams.has(key)).some(Boolean);
}

/**
 * Custom hook to check if any of the specified keys have values in the URL search parameters or in cookies.
 *
 * @param {string[]} keys - Array of keys (strings) to check in the URL search parameters and cookies.
 * @returns {boolean} - True if any of the keys have values in the search parameters or in the cookies, otherwise false.
 */
export function useSearchParamHasValue(...keys: string[]): boolean {
  const [searchParams] = useSearchParams();
  const cookieSearchParams = useAssetIndexCookieSearchParams();
  const isAssetIndexPage = useIsAssetIndexPage();
  const hasValue = useMemo(
    () => keys.map((key) => searchParams.has(key)).some(Boolean),
    [keys, searchParams]
  );

  const hasValueInCookie =
    isAssetIndexPage && checkValueInCookie(keys, cookieSearchParams);

  return hasValue || hasValueInCookie;
}

/**
 * Function to delete specific keys from the URL search parameters.
 *
 * @param {string[]} keys - Array of keys (strings) to be deleted from the URL search parameters.
 * @param {SetSearchParams} setSearchParams - Function to update the URL search parameters.
 */
export function deleteKeysInSearchParams(
  keys: string[],
  setSearchParams: SetSearchParams
) {
  keys.forEach((key) => {
    setSearchParams((prev) => {
      prev.delete(key);
      return prev;
    });
  });
}

/**
 * Function to delete specific keys from the cookie search parameters and update the cookie.
 *
 * @param {string} organizationId - The organization ID used to name the cookie.
 * @param {string[]} keys - Array of keys (strings) to be deleted from the cookie search parameters.
 * @param {URLSearchParams} cookieSearchParams - URLSearchParams object representing the parameters extracted from cookies.
 */
export function destroyCookieValues(
  organizationId: string,
  keys: string[],
  cookieSearchParams: URLSearchParams,
  modeIsAdvanced: boolean
) {
  const cookieName = modeIsAdvanced
    ? `${organizationId}_advancedAssetFilter`
    : `${organizationId}_assetFilter`;

  keys.forEach((key) => {
    cookieSearchParams.delete(key);
  });
  Cookies.set(cookieName, cookieSearchParams.toString(), {
    path: "/assets",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: 365, // 1 year
  });
}

/**
 * Custom hook to create a handler for clearing specific keys from URL search parameters and cookies.
 *
 * @param {string[]} keys - Array of keys (strings) to be cleared from the URL search parameters and cookies.
 * @returns {Function} - A function that, when called, clears the specified keys from the URL search parameters and, if on the asset index page, also from the cookies.
 */
export function useClearValueFromParams(...keys: string[]): Function {
  const [, setSearchParams] = useSearchParams();
  const cookieSearchParams = useAssetIndexCookieSearchParams();
  const currentOrganization = useCurrentOrganization();
  const isAssetIndexPage = useIsAssetIndexPage();
  const { modeIsAdvanced } = useAssetIndexMode();

  function clearValuesFromParams() {
    if (isAssetIndexPage && currentOrganization) {
      destroyCookieValues(
        currentOrganization.id,
        keys,
        cookieSearchParams,
        modeIsAdvanced
      );
      deleteKeysInSearchParams(keys, setSearchParams);
      return;
    }
    deleteKeysInSearchParams(keys, setSearchParams);
  }

  return clearValuesFromParams;
}
/**
 * Custom hook to provide a handler for destroying specific keys from cookies if on the asset index page.
 *
 * @returns {Object} - An object containing the `destroyCookieValues` function that clears specific keys from cookies.
 */
export function useCookieDestroy() {
  const cookieSearchParams = useAssetIndexCookieSearchParams();
  const currentOrganization = useCurrentOrganization();
  const isAssetIndexPage = useIsAssetIndexPage();
  const { modeIsAdvanced } = useAssetIndexMode();

  /**
   * Function to destroy specific keys from cookies if on the asset index page.
   *
   * @param {string[]} keys - Array of keys (strings) to be removed from the cookies.
   */
  function _destroyCookieValues(keys: string[]) {
    // Check if the current page is the asset index page
    if (isAssetIndexPage && currentOrganization && currentOrganization?.id) {
      // Call the destroyCookieValues utility function to delete keys from cookies and update the cookie
      destroyCookieValues(
        currentOrganization.id,
        keys,
        cookieSearchParams,
        modeIsAdvanced
      );
    }
  }

  return { destroyCookieValues: _destroyCookieValues };
}
