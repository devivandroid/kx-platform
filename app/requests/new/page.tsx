"use client";

import { Interface } from "ethers";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TransactionStatus, type TransactionState } from "@/components/TransactionStatus";
import { isEscrowConfigured, useEscrowContract } from "@/hooks/useEscrowContract";
import { useWallet } from "@/hooks/useWallet";
import { escrowAbi } from "@/lib/contracts/microWorkEscrow";
import { isParticipantType } from "@/lib/participants";
import { isValidUsdcAmount } from "@/lib/validateUsdcAmount";
import { normalizeWeb3Error } from "@/lib/web3";
import { licenseValues, participantTypeValues, resourceTypeValues } from "@/types/resource";
import type { PublishResourceFormValues } from "@/types/task";
import { useState } from "react";

export default function NewRequestPage() {
  const router = useRouter();
  const { address, isArcTestnet, switchToArcTestnet } = useWallet();
  const { createTask, invalidateTasks } = useEscrowContract();
  const [txState, setTxState] = useState<TransactionState>({ phase: "idle" });
  const { register, handleSubmit, watch } = useForm<PublishResourceFormValues>({
    defaultValues: {
      title: "",
      description: "",
      budgetUsdc: "",
      sellerAddress: "",
      category: "",
      tags: "",
      license: "Commercial Use Allowed",
      resourceType: "Software Development",
      agentConsumable: true,
      previewText: "",
      lockedContent: "",
      unlockedContentMock: "",
      requirements: "",
      deadline: "",
      participantType: "human",
      participantName: "",
      operatorAddress: ""
    }
  });
  const selectedParticipantType = watch("participantType");
  const isTxBusy = ["signature", "submitted", "confirming"].includes(txState.phase);

  const onSubmit = async (values: PublishResourceFormValues) => {
    if (!isValidUsdcAmount(values.budgetUsdc)) {
      setTxState({ phase: "error", message: "Enter a valid positive USDC budget." });
      return;
    }

    if (!isEscrowConfigured) {
      setTxState({
        phase: "error",
        message:
          "Escrow contract is not configured. Deploy the contract and set NEXT_PUBLIC_ESCROW_CONTRACT."
      });
      return;
    }

    if (values.operatorAddress.trim() && !/^0x[a-fA-F0-9]{40}$/.test(values.operatorAddress.trim())) {
      setTxState({
        phase: "error",
        message: "Enter a valid operator wallet address or leave it blank."
      });
      return;
    }

    if (!address) {
      setTxState({ phase: "error", message: "Connect MetaMask first." });
      return;
    }

    if (!isArcTestnet) {
      await switchToArcTestnet();
      return;
    }

    try {
      setTxState({ phase: "signature", message: "Confirm request creation in MetaMask." });

      const metadata = {
        title: values.title.trim(),
        description: values.description.trim(),
        requirements: values.requirements.trim(),
        category: values.category.trim(),
        tags: values.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        budgetUSDC: values.budgetUsdc.trim(),
        license: values.license,
        accessType: "manual",
        requesterAddress: address,
        participantType: isParticipantType(values.participantType)
          ? values.participantType
          : "human",
        participantName: values.participantName.trim() || undefined,
        operatorAddress: values.operatorAddress.trim() || undefined,
        resourceType: values.resourceType,
        agentConsumable: values.agentConsumable,
        deadline: values.deadline || null,
        createdFrom: "Arc Knowledge Exchange"
      };
      const metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
      const tx = await createTask(values.budgetUsdc, metadataURI);

      setTxState({ phase: "submitted", hash: tx.hash, message: "Request creation submitted." });
      const receipt = await tx.wait();
      setTxState({
        phase: "confirming",
        hash: tx.hash,
        message: "Request created. Reading confirmation logs."
      });

      const escrowInterface = new Interface(escrowAbi);
      const requestCreatedLog = receipt?.logs
        .map((log) => {
          try {
            return escrowInterface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log?.name === "TaskCreated");

      const requestId = requestCreatedLog?.args?.taskId?.toString();
      await invalidateTasks();

      if (requestId) {
        setTxState({
          phase: "success",
          hash: tx.hash,
          message: "Request created successfully. Fund escrow to activate it."
        });
        router.push(`/tasks/${requestId}?created=1`);
        return;
      }

      setTxState({
        phase: "success",
        hash: tx.hash,
        message: "Request created successfully. Open Requests to find it and fund escrow."
      });
      router.push("/requests");
    } catch (error) {
      setTxState({ phase: "error", message: normalizeWeb3Error(error) });
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Requests"
        title="Create Request"
        description="Request a custom knowledge asset or service and secure the budget with USDC escrow on Arc."
      />

      {!isEscrowConfigured ? (
        <div className="mb-5 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          Escrow contract is not configured. Deploy the contract and set
          NEXT_PUBLIC_ESCROW_CONTRACT.
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-5 rounded-lg border border-arc-border bg-arc-panel/80 p-5 shadow-glow lg:grid-cols-2"
      >
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Title</span>
          <input
            {...register("title")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Design a semantic retrieval pipeline for regulatory content"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Budget in USDC</span>
          <input
            {...register("budgetUsdc")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="5.0"
            inputMode="decimal"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Resource type</span>
          <select
            {...register("resourceType")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {resourceTypeValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">License</span>
          <select
            {...register("license")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {licenseValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Category</span>
          <input
            {...register("category")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Knowledge Engineering"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Tags</span>
          <input
            {...register("tags")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Retrieval, Compliance, Agents"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Requester Type</span>
          <select
            {...register("participantType")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {participantTypeValues.map((value) => (
              <option key={value} value={value}>
                {value === "organization"
                  ? "Organization"
                  : value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
          {selectedParticipantType === "agent" ? (
            <span className="text-xs leading-5 text-slate-500">
              Use this when an autonomous agent or agent-controlled service is requesting work.
            </span>
          ) : null}
          {selectedParticipantType === "organization" ? (
            <span className="text-xs leading-5 text-slate-500">
              Use this when a team, company or project is requesting work.
            </span>
          ) : null}
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">Requester Name</span>
          <input
            {...register("participantName")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Autonomous Economy Lab"
          />
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Operator Wallet (optional)</span>
          <input
            {...register("operatorAddress")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="0x..."
          />
          <span className="text-xs leading-5 text-slate-500">
            Self-declared metadata only. This does not verify identity or wallet ownership.
          </span>
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Requirements</span>
          <input
            {...register("requirements")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Deliver a concise guide with scope, implementation notes, acceptance criteria, and validation steps."
          />
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Deadline (optional)</span>
          <input
            {...register("deadline")}
            className="rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            type="date"
          />
        </label>

        <label className="flex items-center gap-3 lg:col-span-2">
          <input
            {...register("agentConsumable")}
            type="checkbox"
            className="size-4 rounded border-arc-border bg-black/30"
          />
          <span className="text-sm font-medium text-slate-200">Agent-consumable metadata</span>
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea
            {...register("description")}
            className="min-h-40 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Describe the deliverable, intended audience, expected format, context, and acceptance criteria."
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={isTxBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-mint px-5 py-3 text-sm font-semibold text-arc-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isTxBusy ? <LoadingSpinner /> : null}
            {isTxBusy ? "Waiting for wallet..." : "Create Request"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <TransactionStatus state={txState} />
      </div>
    </PageShell>
  );
}
