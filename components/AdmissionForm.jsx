"use client";

import { useState, useEffect } from "react";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
 
import CheckAdminAuth from "@/lib/CheckAdminAuth";
 

// ✅ Reusable Label component
function Label({ children, required }) {
  return (
    <label className="block font-medium">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

export default function AdmissionForm({ onStudentAdded }) { 
  const [formData, setFormData] = useState({
    regdNo: "",
    studentName: "",
    fatherName: "",
    presentAddress: "",
    addressAsPerAadhar: "",
    aadharNo: "",
    gender: "",
    dob: "",
    email: "",
    phone1: "",
    phone2: "",
    qualification: "",
    college: "",
    degree: "",
    branch: "",
    yearOfPassing: "",
    workExperience: "",
    workCompany: "",
    skillSet: "",
    courseTitle: "",
    dateOfJoining: "",
    timings: "",
    totalFee: "",
    payedFee: "",
    remarks: "",
  });

  const [lastRegdNo, setLastRegdNo] = useState("0");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch last registration number on component mount
  useEffect(() => {
    fetchLastRegdNo();
  }, []);

  const fetchLastRegdNo = async () => {
    try {
      const response = await fetch("/api/get-last-registration");
      const data = await response.json();
      if (response.ok) {
        setLastRegdNo(data.lastRegdNo);
      } else {
        console.warn("Failed to fetch last registration number:", data.error || "Unknown error");
        setLastRegdNo("0"); // Fallback to 0
      }
    } catch (error) {
      console.error("Error fetching last registration number:", error);
      setLastRegdNo("0"); // Fallback to 0
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get next registration number
  const getNextRegdNo = () => {
    const lastNum = parseInt(lastRegdNo) || 0;
    return (lastNum + 1).toString();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Check for existing user when phone number is entered
    
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submissions

    try {
      // Mandatory fields
      const mandatoryFields = [
        { field: "regdNo", label: "Registration No." },
        { field: "studentName", label: "Student Name" },
        { field: "fatherName", label: "Father's Name" },
        { field: "gender", label: "Gender" },
        { field: "dob", label: "Date of Birth" },
        { field: "aadharNo", label: "Aadhar No." },
        { field: "email", label: "Email" },
        { field: "phone1", label: "Phone 1 (Primary)" },
        { field: "qualification", label: "Qualification" },
        { field: "degree", label: "Degree" },
        { field: "branch", label: "Branch" },
        { field: "yearOfPassing", label: "Year of Passing" },
        { field: "courseTitle", label: "Course / Project Title" },
        { field: "dateOfJoining", label: "Date of Joining" },
        { field: "totalFee", label: "Total Fee" },
        { field: "payedFee", label: "Payed Fee" },
      ];

      for (const { field, label } of mandatoryFields) {
        if (!formData[field]) {
          alert(`❌ ${label} is required.`);
          return;
        }
      }

      // Basic phone validation: require at least 10 digits
      const phoneDigits = String(formData.phone1 || "").replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        alert("❌ Phone 1 must have at least 10 digits.");
        return;
      }

      // Lock submit after validation passes
      setIsSubmitting(true);

      // Payload
      const payload = {
        regdNo: formData.regdNo,
        name: formData.studentName,
        email: formData.email,
        phone1: formData.phone1,
        dob: formData.dob,
        aadharNo: formData.aadharNo,
        presentAddress: formData.presentAddress,
        addressAsPerAadhar: formData.addressAsPerAadhar,
        gender: formData.gender,
        college: formData.college,
        degree: formData.degree,
        branch: formData.branch,
        classId: formData.courseTitle || "general",
        courseTitle: formData.courseTitle,
        totalFee: formData.totalFee,
        PayedFee: formData.payedFee,
        workExperience: formData.workExperience,
        workCompany: formData.workCompany,
        skillSet: formData.skillSet,
        remarks: formData.remarks,
      };

      const res = await makeAuthenticatedRequest("/api/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add student");

      alert("✅ Student added successfully! Default Password: Vawe@2025");

      // Fire welcome email (non-blocking)
      try {
        fetch("/api/send-admission-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, name: formData.studentName }),
        }).catch(() => {});
      } catch (_) {}

      // Reset form and refresh last registration number
      setFormData({
        regdNo: "",
        studentName: "",
        fatherName: "",
        presentAddress: "",
        addressAsPerAadhar: "",
        aadharNo: "",
        gender: "",
        dob: "",
        email: "",
        phone1: "",
        phone2: "",
        qualification: "",
        college: "",
        degree: "",
        branch: "",
        yearOfPassing: "",
        workExperience: "",
        workCompany: "",
        skillSet: "",
        courseTitle: "",
        dateOfJoining: "",
        timings: "",
        totalFee: "",
        payedFee: "",
        remarks: "",
      });
      
      // Refresh the last registration number
      await fetchLastRegdNo();

      // Notify parent (e.g., to close modal and refresh lists)
      try { if (onStudentAdded) await onStudentAdded(); } catch (_) {}
    } catch (error) {
      console.error("Error adding student: ", error);
      alert("❌ Error saving student. " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CheckAdminAuth>
      <div className="max-w-5xl mx-auto p-8 bg-white shadow-md rounded-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-blue-700">
            🎓 Admission Form
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Info */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Regd. No. (Unique)</Label>
                {/* <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">
                    Last Registration No.: <span className="font-semibold text-blue-600">{loading ? "Loading..." : lastRegdNo}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, regdNo: getNextRegdNo() }))}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Use Next ({getNextRegdNo()})
                  </button>
                </div> */}
                <input
                  type="text"
                  name="regdNo"
                  value={formData.regdNo}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder={`Enter unique registration number (suggested: ${getNextRegdNo()})`}
                />
              </div>
              <div>
                <Label required>Student Name</Label>
                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Father&apos;s Name</Label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Gender</Label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <Label required>Date of Birth</Label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Aadhar No.</Label>
                <input
                  type="text"
                  name="aadharNo"
                  value={formData.aadharNo}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Contact Info */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Email</Label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Phone 1 (Primary)</Label>
                <input
                  type="tel"
                  name="phone1"
                  value={formData.phone1}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
                <p className="text-sm text-gray-500">⚠️ Must be unique</p>
              </div>
              <div>
                <Label>Phone 2</Label>
                <input
                  type="tel"
                  name="phone2"
                  value={formData.phone2}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Educational Details */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Educational Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Qualification</Label>
                <input
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label>College / University</Label>
                <input
                  type="text"
                  name="college"
                  value={formData.college}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Degree</Label>
                <input
                  type="text"
                  name="degree"
                  value={formData.degree}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Branch</Label>
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Year of Passing</Label>
                <input
                  type="number"
                  name="yearOfPassing"
                  value={formData.yearOfPassing}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Work Experience */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Work Experience
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Work Experience (Years)</Label>
                <input
                  type="number"
                  name="workExperience"
                  value={formData.workExperience}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label>Company</Label>
                <input
                  type="text"
                  name="workCompany"
                  value={formData.workCompany}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label>Skill Set</Label>
                <input
                  type="text"
                  name="skillSet"
                  value={formData.skillSet}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Course Details */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Course Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Course / Project Title</Label>
                <input
                  type="text"
                  name="courseTitle"
                  value={formData.courseTitle}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Date of Joining</Label>
                <input
                  type="date"
                  name="dateOfJoining"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label>Timings</Label>
                <input
                  type="text"
                  name="timings"
                  value={formData.timings}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Fee Details */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Fee Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Total Fee</Label>
                <input
                  type="number"
                  name="totalFee"
                  value={formData.totalFee}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <Label required>Payed Fee</Label>
                <input
                  type="number"
                  name="payedFee"
                  value={formData.payedFee}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </section>

          {/* Remarks */}
          <section>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">
              Additional Information
            </h3>
            <div>
              <Label>Remarks</Label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="Any additional notes or remarks about the student..."
                rows="4"
              />
            </div>
          </section>

          {/* Submit */}
          <div className="text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={`bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? "Submitting..." : "Submit Admission"}
            </button>
          </div>
        </form>
      </div>
    </CheckAdminAuth>
  );
}
