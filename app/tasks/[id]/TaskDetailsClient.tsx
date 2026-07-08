"use client";

import { useState } from "react";
import { isAddress, keccak256, toUtf8Bytes } from "ethers";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { TransactionStatus, type TransactionState } from "@/components/TransactionStatus";
import { TrustCheckButton } from "@/components/TrustCheckButton";
import {
  isEscrowConfigured,
  useEscrowContract,
  useHasApplied,
  useTask,
  useTaskApplicants
} from "@/hooks/useEscrowContract";
import { useUsdc } from "@/hooks/useUsdc";
import { useWallet } from "@/hooks/useWallet";
import { getIdentitySourceLabel } from "@/lib/arcNative";
import { escrowContractAddress, usdcDecimals } from "@/lib/contracts/microWorkEscrow";
import {
  getEntityTypeLabel,
  getParticipantBadgeClass,
  getUserTypeFromLegacy,
  getUserTypeLabel
} from "@/lib/participants";
import { parseTaskMetadata } from "@/lib/taskMetadata";
import { encodeJsonDataUri } from "@/lib/utf8Base64";
import { getExplorerAddressUrl, normalizeWeb3Error, shortenAddress } from "@/lib/web3";

const zeroAddress = "0x0000000000000000000000000000000000000000";
const lifecycleSteps = ["Created", "Funded", "Assigned", "Submitted", "Released"];

type RunnableTransaction = {
  hash: string;
  wait: () => Promise<unknown>;
};

type TaskDetailsClientProps = {
  taskId: bigint | null;
};

function formatTimestamp(value: bigint): string {
  if (value === 0n) {
    return "Not set";
  }

  return new Date(Number(value) * 1000).toLocaleString();
}

function StatusTimeline({ status }: { status: string }) {
  const currentIndex = lifecycleSteps.indexOf(status);

  return (
    <div className="mt-6 rounded-lg border border-arc-border bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">Status timeline</p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {lifecycleSteps.map((step, index) => {
          const isDone = currentIndex >= index && currentIndex !== -1;
          const isCurrent = currentIndex === index;

          return (
            <div
              key={step}
              className={`rounded-lg border p-3 ${
                isCurrent
                  ? "border-arc-blue bg-arc-blue/10"
                  : isDone
                    ? "border-arc-mint/40 bg-arc-mint/10"
                    : "border-arc-border bg-white/5"
              }`}
            >
              <p className="text-xs font-medium text-slate-500">Step {index + 1}</p>
              <p className="mt-1 text-sm font-semibold text-white">{step}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskDetailsClient({ taskId }: TaskDetailsClientProps) {
  const searchParams = useSearchParams();
  const { address, isArcTestnet, switchToArcTestnet } = useWallet();
  const { approve, allowance, balance, invalidateUsdc } = useUsdc();
  const {
    fundTask,
    assignFreelancer,
    applyForTask,
    submitWork,
    approveAndRelease,
    cancelTask,
    invalidateTasks
  } = useEscrowContract();
  const taskQuery = useTask(taskId);
  const applicantsQuery = useTaskApplicants(taskId);
  const hasAppliedQuery = useHasApplied(taskId, address);
  const [freelancerAddress, setFreelancerAddress] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [txState, setTxState] = useState<TransactionState>({ phase: "idle" });

  const task = taskQuery.data;
  const metadata = task ? parseTaskMetadata(task.metadataURI) : null;
  const deliveryMetadata = task ? parseTaskMetadata(task.deliveryURI) : null;
  const requesterName = metadata?.participantName || "Buyer";
  const requesterType = metadata?.participantType;
  const requesterUserType = metadata?.userType ?? getUserTypeFromLegacy(requesterType);
  const providerName = metadata?.providerParticipantName || "Provider";
  const providerType = metadata?.providerParticipantType;
  const providerUserType = metadata?.providerUserType ?? getUserTypeFromLegacy(providerType);
  const normalizedAddress = address?.toLowerCase();
  const isClient = Boolean(
    task && normalizedAddress && task.client.toLowerCase() === normalizedAddress
  );
  const isFreelancer = Boolean(
    task && normalizedAddress && task.freelancer.toLowerCase() === normalizedAddress
  );
  const canViewSubmission = isClient || isFreelancer;
  const needsApproval = Boolean(task && allowance < task.amount);
  const hasEnoughBalance = Boolean(task && balance >= task.amount);
  const applicants = applicantsQuery.data ?? [];
  const isTxBusy = ["signature", "submitted", "confirming"].includes(txState.phase);
  const wasJustCreated = searchParams.get("created") === "1";
  const arcJobId = metadata?.arcJobId ?? (task ? `arc-job:onchain:${task.id.toString()}` : null);
  const roleLabel = !address
    ? "Wallet not connected"
    : isClient
      ? "You are the buyer"
      : isFreelancer
        ? "You are the assigned provider"
        : "You are viewing this Job";
  const roleMessage = !address
    ? "Connect MetaMask to apply, fund, submit a deliverable, or release settlement."
    : !isArcTestnet
      ? "Switch to Arc Testnet before sending transactions."
      : isClient
        ? "Use the buyer wallet to fund, assign, cancel, or release settlement."
        : isFreelancer
          ? "Use the assigned provider wallet to submit a completed deliverable."
          : task?.statusLabel === "Funded"
            ? "You can apply for this funded Job."
            : "Connect the wallet required for the next action.";

  const runTx = async (action: () => Promise<RunnableTransaction>, message: string) => {
    if (!isArcTestnet) {
      await switchToArcTestnet();
      return;
    }

    try {
      setTxState({ phase: "signature", message });
      const tx = await action();
      setTxState({ phase: "submitted", hash: tx.hash, message: "Transaction submitted." });
      await tx.wait();
      await invalidateTasks();
      await invalidateUsdc();
      setTxState({ phase: "success", hash: tx.hash, message: "Transaction confirmed." });
    } catch (error) {
      setTxState({ phase: "error", message: normalizeWeb3Error(error) });
    }
  };

  const handleApprove = async () => {
    if (task) {
      await runTx(() => approve(task.amountUsdc), "Approve USDC spending in MetaMask.");
    }
  };

  const handleFund = async () => {
    if (!task) {
      return;
    }

    if (!hasEnoughBalance) {
      setTxState({ phase: "error", message: "Insufficient USDC balance." });
      return;
    }

    await runTx(() => fundTask(task.id), "Fund protected settlement in MetaMask.");
  };

  const handleAssign = async () => {
    if (!task) {
      return;
    }

    if (
      !isAddress(freelancerAddress) ||
      freelancerAddress.toLowerCase() === task.client.toLowerCase()
    ) {
      setTxState({
        phase: "error",
        message: "Enter a valid provider address different from the buyer."
      });
      return;
    }

    await runTx(() => assignFreelancer(task.id, freelancerAddress), "Assign provider in MetaMask.");
  };

  const assignCandidate = async (candidateWallet: string) => {
    if (!task) {
      return;
    }

    await runTx(() => assignFreelancer(task.id, candidateWallet), "Assign provider in MetaMask.");
  };

  const handleAssignApplicant = async (applicantAddress: string) => {
    await assignCandidate(applicantAddress);
  };

  const handleApply = async () => {
    if (!task) {
      return;
    }

    await runTx(() => applyForTask(task.id), "Apply for this Job in MetaMask.");
  };

  const handleSubmitWork = async () => {
    if (!task || !deliveryText.trim()) {
      setTxState({ phase: "error", message: "Enter deliverable notes or a deliverable link first." });
      return;
    }

    const deliveryPayload = {
      note: deliveryText.trim(),
      submittedAt: new Date().toISOString(),
      createdFrom: "KX Platform"
    };
    const deliveryURI = encodeJsonDataUri(deliveryPayload);
    const deliveryHash = keccak256(toUtf8Bytes(deliveryURI));
    await runTx(
      () => submitWork(task.id, deliveryHash, deliveryURI),
      "Submit deliverable in MetaMask."
    );
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Job detail"
        title={metadata?.title || (task ? `Job #${task.id.toString()}` : "Job Details")}
        description={
          metadata?.description ||
          "Review Job scope, deliverable status, provider submission, and settlement state on Arc Testnet."
        }
      />

      {!isEscrowConfigured ? (
        <div className="mb-5 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          Protected settlement contract is not configured. Deploy the contract and set
          NEXT_PUBLIC_ESCROW_CONTRACT.
        </div>
      ) : null}

      {taskQuery.isLoading ? (
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-6 text-sm text-slate-400">
          Loading Job from Arc Testnet...
        </div>
      ) : null}

      {taskQuery.error || taskId === null ? (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-100">
          Unable to load this Job. Check the Job ID and contract configuration.
        </div>
      ) : null}

      {task ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
          <section className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusBadge status={task.statusLabel} />
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getParticipantBadgeClass(
                    requesterType
                  )}`}
                >
                  {getUserTypeLabel(requesterUserType)} buyer
                </span>
              </div>
              {escrowContractAddress ? (
                <a
                  href={getExplorerAddressUrl(escrowContractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-arc-blue hover:text-white"
                >
                  Settlement contract
                </a>
              ) : null}
            </div>

            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Job model</dt>
                <dd className="mt-1 text-white">Arc Compatible Job</dd>
              </div>
              <div>
                <dt className="text-slate-500">Buyer</dt>
                <dd className="mt-1">
                  <span className="mb-1 block text-white">{requesterName}</span>
                  <a
                    href={getExplorerAddressUrl(task.client)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:text-arc-blue"
                  >
                    {shortenAddress(task.client)}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Settlement</dt>
                <dd className="mt-1 text-white">Protected USDC settlement</dd>
              </div>
              <div>
                <dt className="text-slate-500">Identity Source</dt>
                <dd className="mt-1 text-white">{getIdentitySourceLabel(metadata?.identitySource)}</dd>
              </div>
              {arcJobId ? (
                <div>
                  <dt className="text-slate-500">Arc Job ID</dt>
                  <dd className="mt-1 break-all text-white">{arcJobId}</dd>
                </div>
              ) : null}
              {metadata?.arcIdentityId ? (
                <div>
                  <dt className="text-slate-500">Arc Identity ID</dt>
                  <dd className="mt-1 break-all text-white">{metadata.arcIdentityId}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">User Type</dt>
                <dd className="mt-1 text-white">{getUserTypeLabel(requesterUserType)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Entity Type</dt>
                <dd className="mt-1 text-white">{getEntityTypeLabel(metadata?.entityType)}</dd>
              </div>
              {metadata?.operatorAddress ? (
                <div>
                  <dt className="text-slate-500">Operator wallet</dt>
                  <dd className="mt-1">
                    <a
                      href={getExplorerAddressUrl(metadata.operatorAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white hover:text-arc-blue"
                    >
                      {shortenAddress(metadata.operatorAddress)}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">Provider</dt>
                <dd className="mt-1">
                  {task.freelancer === zeroAddress ? (
                    <span className="text-white">Not assigned</span>
                  ) : (
                    <>
                      {metadata?.providerParticipantName ? (
                        <span className="mb-1 block text-white">{providerName}</span>
                      ) : null}
                      <a
                        href={getExplorerAddressUrl(task.freelancer)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:text-arc-blue"
                      >
                        {shortenAddress(task.freelancer)}
                      </a>
                    </>
                  )}
                </dd>
              </div>
              {providerType ? (
                <div>
                  <dt className="text-slate-500">Provider User Type</dt>
                  <dd className="mt-1 text-white">{getUserTypeLabel(providerUserType)}</dd>
                </div>
              ) : null}
              {metadata?.providerEntityType ? (
                <div>
                  <dt className="text-slate-500">Provider Entity Type</dt>
                  <dd className="mt-1 text-white">
                    {getEntityTypeLabel(metadata.providerEntityType)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd className="mt-1 text-white">{task.amountUsdc} USDC</dd>
              </div>
              <div>
                <dt className="text-slate-500">License</dt>
                <dd className="mt-1 text-white">{metadata?.license || "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Product type</dt>
                <dd className="mt-1 text-white">{metadata?.resourceType || "Custom Service"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">USDC precision</dt>
                <dd className="mt-1 text-white">{usdcDecimals}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-1 text-white">{formatTimestamp(task.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Funded</dt>
                <dd className="mt-1 text-white">{formatTimestamp(task.fundedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Submitted</dt>
                <dd className="mt-1 text-white">{formatTimestamp(task.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Released</dt>
                <dd className="mt-1 text-white">{formatTimestamp(task.releasedAt)}</dd>
              </div>
            </dl>

            <StatusTimeline status={task.statusLabel} />

            <div className="mt-6 grid gap-3">
              {task.statusLabel === "Submitted" || task.statusLabel === "Released" ? (
                <div className="rounded-lg border border-arc-mint/30 bg-arc-mint/10 p-4">
                  <p className="text-sm font-semibold text-arc-mint">Provider deliverable</p>
                  {canViewSubmission && deliveryMetadata?.note ? (
                    <p className="mt-3 rounded-lg bg-black/30 p-3 text-sm leading-6 text-slate-200">
                      {deliveryMetadata.note}
                    </p>
                  ) : !canViewSubmission ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-arc-border bg-black/30 p-3">
                      <p className="select-none text-sm leading-6 text-slate-300 blur-sm">
                        Deliverable content is hidden from viewers who are not the buyer or
                        assigned provider.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        This Job has a provider deliverable, but only the buyer and assigned
                        provider can view its contents in the app.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      The provider submitted a deliverable. Technical details store the delivery URI and
                      hash.
                    </p>
                  )}
                </div>
              ) : null}

              {metadata?.description ? (
                <div>
                  <p className="text-sm text-slate-500">Job description</p>
                  <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm leading-6 text-slate-300">
                    {metadata.description}
                  </p>
                </div>
              ) : null}
              {metadata?.requirements ? (
                <div>
                  <p className="text-sm text-slate-500">Requirements</p>
                  <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm leading-6 text-slate-300">
                    {metadata.requirements}
                  </p>
                </div>
              ) : null}
              {metadata?.deadline ? (
                <div>
                  <p className="text-sm text-slate-500">Deadline</p>
                  <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm text-slate-300">
                    {metadata.deadline}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="self-start rounded-lg border border-arc-border bg-arc-panel/80 p-5">
            {isClient && task.statusLabel === "Created" ? (
              <div className="mb-5 rounded-lg border border-arc-mint/40 bg-arc-mint/10 p-4">
                <p className="text-sm font-semibold text-arc-mint">
                  {wasJustCreated ? "Job created" : "Fund this Job"}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">Next step: fund settlement</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Funding locks USDC for protected settlement so a provider can start work.
                </p>
                <dl className="mt-4 grid gap-2 text-xs text-slate-400">
                  <div className="flex justify-between gap-3">
                    <dt>Budget amount</dt>
                    <dd className="font-semibold text-white">{task.amountUsdc} USDC</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Job ID</dt>
                    <dd className="font-semibold text-white">#{task.id.toString()}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Buyer wallet</dt>
                    <dd className="font-semibold text-white">{shortenAddress(task.client)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Status</dt>
                    <dd className="font-semibold text-white">Created</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div>
              <p className="text-sm text-slate-500">Connected wallet</p>
              <p className="mt-1 text-sm text-white">
                {address ? shortenAddress(address) : "Not connected"}
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-arc-border bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">{roleLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{roleMessage}</p>
              {!isArcTestnet && address ? (
                <button
                  type="button"
                  onClick={switchToArcTestnet}
                  className="mt-3 rounded-lg border border-arc-border bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:border-arc-blue"
                >
                  Switch to Arc Testnet
                </button>
              ) : null}
            </div>

            <div className="mt-5 rounded-lg border border-arc-border bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Next step</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {task.statusLabel === "Created"
                  ? "Lock the Job budget for settlement. First approve USDC spending, then fund the Job."
                  : task.statusLabel === "Funded"
                    ? isClient
                      ? "Review applicants and assign the provider who will deliver this Job."
                      : "Apply for this Job so the buyer can assign you."
                    : task.statusLabel === "Assigned"
                      ? "The assigned provider can submit a deliverable note or link."
                      : task.statusLabel === "Submitted"
                        ? "Review the submitted deliverable and release settlement if it is approved."
                        : task.statusLabel === "Released"
                          ? "Funds have been released to the provider."
                          : "This Job has been cancelled."}
              </p>
            </div>

            {isClient && task.statusLabel === "Created" ? (
              <div className="mt-5 grid gap-3">
                {needsApproval ? (
                  <div className="rounded-lg border border-arc-border bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">1. Approve USDC</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      This gives the settlement contract permission to move exactly {task.amountUsdc}{" "}
                      USDC from your wallet when you fund the Job.
                    </p>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isTxBusy}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTxBusy ? <LoadingSpinner /> : null}
                      Approve {task.amountUsdc} USDC
                    </button>
                  </div>
                ) : null}
                <div className="rounded-lg border border-arc-border bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Fund this Job</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    This locks {task.amountUsdc} USDC for protected settlement. The provider only
                    receives it after you approve the submitted deliverable.
                  </p>
                  <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                    MetaMask may only show the network fee for this transaction. If you continue,
                    the settlement contract will transfer {task.amountUsdc} USDC from your wallet
                    into protected settlement.
                  </p>
                  <button
                    type="button"
                    onClick={handleFund}
                    disabled={needsApproval || isTxBusy}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-mint px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTxBusy ? <LoadingSpinner /> : null}
                    {needsApproval ? "Approve USDC first" : `Fund Settlement (${task.amountUsdc} USDC)`}
                  </button>
                </div>
              </div>
            ) : null}

            {isClient && task.statusLabel === "Funded" ? (
              <div className="mt-5 rounded-lg border border-arc-mint/40 bg-arc-mint/10 p-4">
                <p className="text-sm font-semibold text-arc-mint">Settlement funded</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Next step: assign a provider once you are ready for the deliverable.
                </p>
              </div>
            ) : null}

            {!isClient && task.statusLabel === "Created" ? (
              <div className="mt-5 rounded-lg border border-arc-border bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Connect the buyer wallet to fund/release
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Only the buyer can approve USDC and fund this Job.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  Buyer wallet required
                </button>
              </div>
            ) : null}

            {isClient && task.statusLabel === "Funded" ? (
              <div className="mt-5 grid gap-3">
                <div className="rounded-lg border border-arc-border bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Applicants</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Providers can apply on-chain. Pick one applicant to assign this Job.
                  </p>
                  <div className="mt-4 grid gap-2">
                    {applicantsQuery.isLoading ? (
                      <p className="text-sm text-slate-500">Loading applicants...</p>
                    ) : applicants.length > 0 ? (
                      applicants.map((applicant) => (
                        <div
                          key={applicant}
                          className="flex flex-col gap-3 rounded-lg border border-arc-border bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-sm font-medium text-white">
                            {shortenAddress(applicant)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <TrustCheckButton
                              wallet={applicant}
                              disabled={isTxBusy}
                              onProceed={assignCandidate}
                              allowActionLabel="Assign"
                              reviewActionLabel="Assign Anyway"
                              warningText="KX recommends review before assignment. You can still assign if you accept the risk."
                            />
                            <button
                              type="button"
                              onClick={() => handleAssignApplicant(applicant)}
                              disabled={isTxBusy}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-blue px-3 py-2 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isTxBusy ? <LoadingSpinner /> : null}
                              Assign
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-arc-border bg-black/20 p-3 text-sm text-slate-500">
                        No applicants yet.
                      </p>
                    )}
                  </div>
                </div>

                <details className="rounded-lg border border-arc-border bg-black/20 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-300">
                    Assign manually
                  </summary>
                  <div className="mt-4 grid gap-3">
                    <p className="text-sm leading-6 text-slate-400">
                      Use this if the provider shared their wallet address outside the app.
                    </p>
                    <input
                      value={freelancerAddress}
                      onChange={(event) => setFreelancerAddress(event.target.value)}
                      placeholder="Provider wallet address"
                      className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue"
                    />
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={isTxBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTxBusy ? <LoadingSpinner /> : null}
                      Assign Provider
                    </button>
                    <TrustCheckButton
                      wallet={freelancerAddress}
                      disabled={isTxBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60"
                      onProceed={assignCandidate}
                      allowActionLabel="Assign"
                      reviewActionLabel="Assign Anyway"
                      warningText="KX recommends review before assignment. You can still assign if you accept the risk."
                    />
                  </div>
                </details>
              </div>
            ) : null}

            {!isClient && task.statusLabel === "Funded" ? (
              <div className="mt-5 rounded-lg border border-arc-border bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Apply as provider</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Apply on-chain so the buyer can see your wallet and assign the Job to you.
                </p>
                <TrustCheckButton
                  wallet={task.client}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!address || hasAppliedQuery.data || isTxBusy}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTxBusy ? <LoadingSpinner /> : null}
                  {hasAppliedQuery.data ? "Already applied" : "Apply for this Job"}
                </button>
              </div>
            ) : null}

            {isFreelancer && task.statusLabel === "Assigned" ? (
              <div className="mt-5 grid gap-3">
                <p className="text-sm leading-6 text-slate-400">
                  Submit a short deliverable note or link. The app stores a hash of this text on-chain.
                </p>
                <textarea
                  value={deliveryText}
                  onChange={(event) => setDeliveryText(event.target.value)}
                  placeholder="Deliverable notes or link"
                  className="min-h-28 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue"
                />
                <button
                  type="button"
                  onClick={handleSubmitWork}
                  disabled={isTxBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isTxBusy ? <LoadingSpinner /> : null}
                  Submit Deliverable
                </button>
              </div>
            ) : null}

            {!isFreelancer && task.statusLabel === "Assigned" ? (
              <div className="mt-5 rounded-lg border border-arc-border bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Connect the provider wallet to submit deliverable
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Deliverables can only be submitted by the wallet assigned to this Job.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  Provider wallet required
                </button>
              </div>
            ) : null}

            {isClient && task.statusLabel === "Submitted" ? (
              <button
                type="button"
                onClick={() =>
                  runTx(() => approveAndRelease(task.id), "Release funds in MetaMask.")
                }
                disabled={isTxBusy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-mint px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTxBusy ? <LoadingSpinner /> : null}
                Approve & Release Funds
              </button>
            ) : null}

            {!isClient && task.statusLabel === "Submitted" ? (
              <div className="mt-5 rounded-lg border border-arc-border bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">
                  Connect the buyer wallet to fund/release
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Only the buyer can approve the submitted deliverable and release settlement.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  Buyer wallet required
                </button>
              </div>
            ) : null}

            {isClient && (task.statusLabel === "Created" || task.statusLabel === "Funded") ? (
              <button
                type="button"
                onClick={() => runTx(() => cancelTask(task.id), "Cancel Job in MetaMask.")}
                disabled={isTxBusy}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-300/40 bg-red-300/10 px-4 py-3 text-sm font-semibold text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTxBusy ? <LoadingSpinner /> : null}
                Cancel Job
              </button>
            ) : null}

            <div className="mt-5">
              <TransactionStatus state={txState} />
            </div>
          </aside>
        </div>
      ) : null}

    </PageShell>
  );
}
