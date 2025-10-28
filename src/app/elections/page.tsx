"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ListChecks, ChevronRight } from "lucide-react";

interface ElectionSummary {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function ElectionsPage() {
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchElections = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/get-elections");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch elections.");
        }
        const data: ElectionSummary[] = await res.json();
        setElections(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchElections();
  }, []);

  const getStatusBadge = (
    status: string,
    startTime: string,
    endTime: string,
  ): React.ReactNode => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (status === "Tallied")
      return (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-700 text-gray-300">
          Finished
        </span>
      );
    if (now < start)
      return (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-blue-900 text-blue-300">
          Upcoming
        </span>
      );
    if (now >= start && now < end)
      return (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-green-900 text-green-300 animate-pulse">
          Active
        </span>
      );
    if (now >= end)
      return (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-yellow-900 text-yellow-300">
          Ended (Awaiting Tally)
        </span>
      );
    return (
      <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-700 text-gray-300">
        {status}
      </span>
    ); // Fallback
  };

  return (
    <div className="container mx-auto px-6 py-16 md:py-24">
      <div className="flex items-center mb-8">
        <ListChecks className="h-8 w-8 text-blue-400 mr-4" />
        <h1 className="text-4xl font-bold">Available Elections</h1>
      </div>

      {isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-400">Loading elections...</p>
          {/* Optional: Add spinner */}
        </div>
      )}

      {error && (
        <div className="text-center py-10 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">Error loading elections: {error}</p>
        </div>
      )}

      {!isLoading && !error && elections.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500">No elections found.</p>
        </div>
      )}

      {!isLoading && !error && elections.length > 0 && (
        <div className="space-y-4">
          {elections.map((election) => (
            <div
              key={election._id}
              className="p-6 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-between hover:bg-gray-700 transition-colors"
            >
              <div>
                <h2 className="text-xl font-semibold mb-1">{election.title}</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  {getStatusBadge(
                    election.status,
                    election.startTime,
                    election.endTime,
                  )}
                  <span>
                    • Starts: {new Date(election.startTime).toLocaleString()}
                  </span>
                  <span>
                    • Ends: {new Date(election.endTime).toLocaleString()}
                  </span>
                </div>
              </div>
              <Link href={`/elections/${election._id}`}>
                <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  Show Details <ChevronRight size={16} className="ml-1" />
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
