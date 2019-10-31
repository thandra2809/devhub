import {
  activePaidPlans as _activePaidPlans,
  activePlans as _activePlans,
  allPlans,
  constants,
  freePlan,
  isPlanExpired,
  Plan,
  PlanID,
} from '@devhub/core'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, FlatListProps, View } from 'react-native'
import { useDispatch } from 'react-redux'

import { useReduxState } from '../../hooks/use-redux-state'
import { Browser } from '../../libs/browser'
import { bugsnag } from '../../libs/bugsnag'
import { Platform } from '../../libs/platform'
import * as actions from '../../redux/actions'
import * as selectors from '../../redux/selectors'
import { sharedStyles } from '../../styles/shared'
import { contentPadding } from '../../styles/variables'
import { ModalColumn } from '../columns/ModalColumn'
import { Button } from '../common/Button'
import { FullHeightScrollView } from '../common/FullHeightScrollView'
import { Spacer } from '../common/Spacer'
import { SubHeader } from '../common/SubHeader'
import { useColumnWidth } from '../context/ColumnWidthContext'
import { useAppLayout } from '../context/LayoutContext'
import {
  defaultPricingBlockWidth,
  PricingPlanBlock,
} from './partials/PricingPlanBlock'

export interface PricingModalProps {
  highlightFeature?: keyof Plan['featureFlags']
  initialSelectedPlanId?: PlanID | undefined
  showBackButton: boolean
}

const plansToShow =
  freePlan && !freePlan.trialPeriodDays ? _activePlans : _activePaidPlans

export function PricingModal(props: PricingModalProps) {
  const {
    highlightFeature: _highlightFeature,
    initialSelectedPlanId,
    showBackButton,
  } = props

  const flatListRef = useRef<FlatList<Plan>>(null)
  const { sizename } = useAppLayout()
  const hasCalledOnLayoutRef = useRef(false)
  const dispatch = useDispatch()
  const appToken = useReduxState(selectors.appTokenSelector)
  const userPlan = useReduxState(selectors.currentUserPlanSelector)
  const columnCount = useReduxState(selectors.columnCountSelector)
  const columnWidth = useColumnWidth()

  const highlightFeature: PricingModalProps['highlightFeature'] =
    _highlightFeature ||
    (userPlan && columnCount >= userPlan.featureFlags.columnsLimit
      ? 'columnsLimit'
      : undefined)

  const userPlanDetails =
    userPlan && userPlan.id && allPlans.find(p => p.id === userPlan.id)
  const userPlanStillExist = !!(
    userPlan &&
    userPlan.id &&
    plansToShow.find(p => p.id === userPlan.id)
  )

  const [selectedPlanId, setSelectedPlanId] = useState<PlanID | undefined>(
    () =>
      (initialSelectedPlanId &&
      plansToShow.find(p => p.id === initialSelectedPlanId)
        ? initialSelectedPlanId
        : undefined) ||
      (_highlightFeature &&
      plansToShow.find(p => p.featureFlags[_highlightFeature] === true)
        ? plansToShow.find(p => p.featureFlags[_highlightFeature] === true)!.id
        : undefined) ||
      (userPlan && userPlanStillExist && userPlan.id) ||
      undefined,
  )

  const selectedPlan =
    selectedPlanId && plansToShow.find(p => p.id === selectedPlanId)

  const scrollToPlan = useCallback(
    (planId: PlanID | undefined) => {
      if (!flatListRef.current) return

      const index = plansToShow.findIndex(p => p.id === planId)
      if (!(index >= 0 && index < plansToShow.length)) return

      flatListRef.current.scrollToOffset({
        animated: hasCalledOnLayoutRef.current,
        offset: Math.max(
          0,
          index * defaultPricingBlockWidth -
            (columnWidth - defaultPricingBlockWidth) / 2,
        ),
      })
    },
    [plansToShow],
  )

  useEffect(() => {
    scrollToPlan(selectedPlanId)
  }, [scrollToPlan, selectedPlanId])

  const getItemLayout = useCallback<
    NonNullable<FlatListProps<Plan>['getItemLayout']>
  >(
    (_data, index) => ({
      index,
      length: defaultPricingBlockWidth,
      offset: index * defaultPricingBlockWidth,
    }),
    [],
  )

  const onLayout = useCallback<
    NonNullable<FlatListProps<Plan>['onLayout']>
  >(() => {
    if (!hasCalledOnLayoutRef.current) {
      scrollToPlan(selectedPlanId)
      hasCalledOnLayoutRef.current = true
    }
  }, [scrollToPlan, selectedPlanId])

  const renderItem = useCallback<
    NonNullable<FlatListProps<Plan>['renderItem']>
  >(
    ({ item: plan }) =>
      plan.amount > 0 ? (
        <PricingPlanBlock
          key={`pricing-plan-${plan.id}`}
          banner={
            plan && typeof plan.banner === 'boolean'
              ? plan.banner
              : (plan && plan.banner) || false
          }
          highlightFeature={highlightFeature}
          isPartOfAList
          isSelected={selectedPlanId === plan.id}
          onSelect={() => {
            setSelectedPlanId(plan.id)
            scrollToPlan(plan.id)
          }}
          plan={plan}
          showFeatures
        />
      ) : (
        <PricingPlanBlock
          key={`pricing-plan-${plan.cannonicalId}`}
          banner
          highlightFeature={highlightFeature}
          isPartOfAList
          isSelected={selectedPlanId === plan.id}
          onSelect={() => {
            setSelectedPlanId(plan.id)
            scrollToPlan(plan.id)
          }}
          plan={plan}
          showFeatures
        />
      ),
    [selectedPlanId, highlightFeature, userPlan && userPlan.amount],
  )

  const CancelSubscriptionButton = (
    <Button
      analyticsCategory="downgrade"
      analyticsAction="downgrade"
      analyticsLabel="downgrade"
      onPress={() => {
        if (Platform.OS !== 'web') {
          Browser.openURLOnNewTab(
            `${constants.DEVHUB_LINKS.ACCOUNT_PAGE}?appToken=${appToken}`,
          )
          return
        }

        dispatch(
          actions.pushModal({
            name: 'SUBSCRIBE',
            params: { planId: undefined },
          }),
        )
      }}
      type="neutral"
    >
      Cancel subscription
    </Button>
  )

  const showUserPlanAtTheTop =
    userPlan &&
    userPlanDetails &&
    (userPlanDetails.amount ||
      (userPlanDetails.trialPeriodDays && !isPlanExpired(userPlan))) &&
    !userPlanStillExist

  return (
    <ModalColumn
      name="PRICING"
      showBackButton={showBackButton}
      title="Subscribe"
    >
      <FullHeightScrollView style={sharedStyles.flex}>
        {!!showUserPlanAtTheTop && (
          <>
            <SubHeader title="CURRENT PLAN" />

            <View style={{ paddingHorizontal: (contentPadding * 3) / 4 }}>
              <PricingPlanBlock
                key="pricing-current-plan"
                banner={false}
                isPartOfAList={false}
                plan={userPlanDetails!}
                width="100%"
              />
            </View>

            <Spacer height={contentPadding} />

            {!!(userPlan && userPlan.amount) &&
              !(freePlan && !freePlan.trialPeriodDays) && (
                <>
                  <View style={sharedStyles.marginHorizontal}>
                    {CancelSubscriptionButton}
                  </View>
                  <Spacer height={contentPadding} />
                </>
              )}
          </>
        )}

        <SubHeader
          title={
            userPlanDetails && userPlanDetails.amount
              ? 'CHANGE PLAN'
              : 'SELECT A PLAN'
          }
        />

        <FlatList
          ref={flatListRef}
          contentContainerStyle={{
            paddingHorizontal: (contentPadding * 3) / 4,
          }}
          data={plansToShow}
          extraData={selectedPlanId}
          getItemLayout={getItemLayout}
          horizontal
          onLayout={onLayout}
          onScrollToIndexFailed={onScrollToIndexFailed}
          renderItem={renderItem}
          style={[sharedStyles.flexNoGrow, sharedStyles.fullWidth]}
        />

        {sizename <= '2-medium' ? (
          <Spacer flex={1} minHeight={contentPadding * 2} />
        ) : (
          <Spacer height={contentPadding * 2} />
        )}

        <View style={[sharedStyles.fullWidth, sharedStyles.paddingHorizontal]}>
          <Button
            analyticsCategory="subscribe"
            analyticsAction="subscribe"
            analyticsLabel="subscribe"
            disabled={
              !selectedPlan || selectedPlan.id === (userPlan && userPlan.id)
            }
            onPress={() => {
              if (!(selectedPlan && selectedPlan.id)) return

              if (Platform.OS !== 'web') {
                Browser.openURLOnNewTab(
                  `${constants.DEVHUB_LINKS.SUBSCRIBE_PAGE}?plan=${selectedPlan.cannonicalId}&appToken=${appToken}`,
                )
                return
              }

              dispatch(
                actions.pushModal({
                  name: 'SUBSCRIBE',
                  params: { planId: selectedPlan.id },
                }),
              )
            }}
            type="primary"
          >
            {selectedPlan
              ? selectedPlan.amount > 0
                ? userPlan && userPlan.id === selectedPlan.id
                  ? 'You are on this plan'
                  : 'Continue'
                : userPlan && userPlan.amount > 0
                ? 'Downgrade to free plan'
                : 'Select another plan'
              : 'Select a plan'}
          </Button>

          <Spacer height={contentPadding} />

          {!(freePlan && !freePlan.trialPeriodDays) &&
            !showUserPlanAtTheTop &&
            !!(userPlan && userPlan.amount) && (
              <>
                {CancelSubscriptionButton}
                <Spacer height={contentPadding} />
              </>
            )}
        </View>
      </FullHeightScrollView>
    </ModalColumn>
  )
}

const onScrollToIndexFailed: NonNullable<
  FlatListProps<string>['onScrollToIndexFailed']
> = info => {
  console.error(info)
  bugsnag.notify({
    name: 'ScrollToIndexFailed',
    message: 'Failed to scroll to index',
    ...info,
  })
}